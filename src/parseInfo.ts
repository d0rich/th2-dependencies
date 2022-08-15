import 'dotenv/config'

import { Octokit, App } from "octokit"
import axios from 'axios'
import ProgressBar from 'progress'
import { IGradleDependency } from './types/gradleDependencies'
import { IDepNode, Th2RepoType } from './types/dependenciesGraph'
import { IPythonDependency } from './types/pythonDependencies'
import { Repositories } from './types/github'
import { parseFunctions } from './custom'
const g2js = require('gradle-to-js/lib/parser')
let progressBar: ProgressBar
let promises: Promise<any>[]

const octokit = new Octokit({
  auth: process.env.GH_TOKEN
})

export async  function parse(){
  const th2Net = await octokit.rest.orgs.get({ org: 'th2-net' })
  console.log('all repos in th2-net', th2Net.data.public_repos)

  const REPOS_PER_PAGE = 100
  
  const repos: Repositories = []
  const commitsCounts = new Map<string, number>()
  const dockerUsageMap = new Map<string, boolean>()
  const reposTypesMap = new Map<string, Th2RepoType>()
  const reposDepandencies = new Map<string, IDepNode[]>()
  for (let i = 0; i * REPOS_PER_PAGE < th2Net.data.public_repos; i ++) {
    repos.push(...(await octokit.rest.repos.listForOrg({ org: 'th2-net', per_page: REPOS_PER_PAGE, page: i + 1})).data)
  }
  
  //Count commits

  progressBar = new ProgressBar('Counting commits [:bar] :repo', {
    total: repos.length,
    width: 20
  })
  promises = repos.map(async repo => {
    let commits = await octokit.rest.repos.listCommits({ owner: repo.owner.login, repo: repo.name })
    commitsCounts.set(repo.name, commits.data.length)
    progressBar.tick({
      repo: repo.name
    })
  })
  await Promise.all(promises)

  // Filter repos

  const filteredRepos = parseFunctions.filterRepos(repos, { commitsCounts })
  console.log('repos after filter:', filteredRepos.length)

  // Get repo meta

  progressBar = new ProgressBar('Getting meta info [:bar] :repo', {
    total: filteredRepos.length,
    width: 20
  })
  promises = filteredRepos.map(async repo => {
    const platformsFlags = {
      jar: false,
      py: false,
      js: false,
      docker: false
    }


    try {
      const { data: dockerfile } = await axios.get(`https://raw.githubusercontent.com/${repo.owner.login}/${repo.name}/master/Dockerfile`)
      if (dockerfile) platformsFlags.docker = true
    } catch (e) {}
    try {
      const { data: packageJson } = await axios.get(`https://raw.githubusercontent.com/${repo.owner.login}/${repo.name}/master/package.json`)
      if (packageJson) platformsFlags.js = true
    } catch (e) {}
    try {
      const { data: requirementsTxt } = await axios.get(`https://raw.githubusercontent.com/${repo.owner.login}/${repo.name}/master/requirements.txt`)
      if (requirementsTxt) platformsFlags.py = true
    } catch (e) {}
    try {
      const { data: gradleBuild } = await axios.get(`https://raw.githubusercontent.com/${repo.owner.login}/${repo.name}/master/build.gradle`)
      if (gradleBuild) platformsFlags.jar = true
    } catch (e) {}

    dockerUsageMap.set(repo.name, platformsFlags.docker)

    if (platformsFlags.jar && platformsFlags.py) reposTypesMap.set(repo.name, 'jar & py')
    else if (platformsFlags.py) reposTypesMap.set(repo.name, 'py')
    else if (platformsFlags.js) reposTypesMap.set(repo.name, 'js')
    else if (platformsFlags.jar) reposTypesMap.set(repo.name, 'jar')
    else reposTypesMap.set(repo.name, 'undefined')
    
    progressBar.tick({
      repo: repo.name
    })
  })
  await Promise.all(promises)

  //Get dependencies

  progressBar = new ProgressBar('Getting dependencies [:bar] :repo', {
    total: filteredRepos.length,
    width: 20
  })
  promises = filteredRepos.map(async repo => {
    const dependencies: IDepNode[] = []
    try {
      const gradleBuildFile = await axios.get(`https://raw.githubusercontent.com/${repo.owner.login}/${repo.name}/master/build.gradle`)
      const parsedGradleBuildFile: { dependencies: IGradleDependency[] } = await g2js.parseText(gradleBuildFile.data)
      const gradleDependencies = parsedGradleBuildFile.dependencies
        .filter(dep => dep.group === 'com.exactpro.th2')
        .map((dep): IDepNode => ({
          name: `th2-${dep.name}`,
          type: 'jar',
          docker: false
          }))
        dependencies.push(...gradleDependencies)
      
    }
    catch(e){}

    try {
      const requirements: { data: string } = await axios.get(`https://raw.githubusercontent.com/${repo.owner.login}/${repo.name}/master/requirements.txt`)
      const parsedRequirements: IDepNode[] = requirements.data
        .split('\n')
        .filter(line => !line.startsWith('#'))
        .filter(line => !!line.trim())
        .map((line): IPythonDependency => {
          if (line.includes('==')) {
            const [name, version] = line.trim().split('==')
            return { name, version }
          }
          if (line.includes('>=')) {
            const [name, version] = line.trim().split('>=')
            return { name, version }
          }
          if (line.includes('<=')) {
            const [name, version] = line.trim().split('<=')
            return { name, version }
          }
          const [name, version] = line.trim().split('~=')
          return { name, version }
        })
        .map(dep => ({
          name: dep.name,
          docker: false,
          type: 'py'
        }))
      dependencies.push(...parsedRequirements)
    }
    catch(e){}
    
    reposDepandencies.set(repo.name, dependencies)
    progressBar.tick({
      repo: repo.name
    })
  })
  await Promise.all(promises)

  const depNodes: IDepNode[] = filteredRepos.map(repo => ({
    name: repo.name,
    docker: dockerUsageMap.get(repo.name) || false,
    type: reposTypesMap.get(repo.name) || 'jar'
  }))

  for (const [repoName, dependencies] of reposDepandencies) {
    for (let i = 0; i < dependencies.length; i++){
      const depNodeIndex = depNodes.findIndex(dep => dep.name === dependencies[i].name)
      if (depNodeIndex > -1) {
        dependencies[i] = depNodes[depNodeIndex]
      }
    }
  }

  return {
    repos: filteredRepos, depNodes,
    dockerUsageMap, reposTypesMap, reposDepandencies
  }
}