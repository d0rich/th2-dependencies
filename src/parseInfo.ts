import 'dotenv/config'

import { Octokit, App } from "octokit"
import axios from 'axios'
import ProgressBar from 'progress'
import { IGradleDependency } from './types/gradleDependencies'
import { IDepNode, Th2RepoType, IDepEdge } from './types/dependenciesGraph'
import { IPythonDependency } from './types/pythonDependencies'
import { Repositories } from './types/github'
import { parseFunctions } from './custom'
const g2js = require('gradle-to-js/lib/parser')
const toml = require('toml');
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
      if (dockerfile.includes('ENTRYPOINT') || dockerfile.includes('EXPOSE')) 
        platformsFlags.docker = true
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
      const { data: requirementsTxt } = await axios.get(`https://raw.githubusercontent.com/${repo.owner.login}/${repo.name}/master/pyproject.toml`)
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

  // Create nodes

  const depNodes: IDepNode[] = filteredRepos.map(repo => ({
    name: repo.name,
    docker: dockerUsageMap.get(repo.name) || false,
    type: reposTypesMap.get(repo.name) || 'jar'
  }))

  const reposNodes: IDepNode[] = depNodes.filter(() => true)

  //Get dependencies

  const depEdges: IDepEdge[] = []

  progressBar = new ProgressBar('Getting dependencies [:bar] :repo', {
    total: filteredRepos.length,
    width: 20
  })

  promises = filteredRepos.map(async repo => {
    const dependencies: IDepEdge[] = []

    
    const node: IDepNode | undefined = reposNodes.find(repoNode => repoNode.name === repo.name)
    if (!node) return

    const includeDependencies = (newDependencies: IDepNode[], options: { type: Th2RepoType }) => {
      for (let i = 0; i < newDependencies.length; i++) {
        const dep = newDependencies[i]
        const existingNode = depNodes.find(node => node.name === dep.name && node.type.includes(options.type))
        if (!existingNode)
          depNodes.push(dep)
        else
          newDependencies[i] = existingNode
      }
      dependencies.push(...newDependencies.map((dep): IDepEdge => {
        return {
          from: dep,
          to: node,
          type: options.type
        }
      }))
    }

    try {
      const gradleBuildFile = await axios.get(`https://raw.githubusercontent.com/${repo.owner.login}/${repo.name}/master/build.gradle`)
      const parsedGradleBuildFile: { dependencies: IGradleDependency[] } = await g2js.parseText(gradleBuildFile.data)
      const gradleDependencies = parsedGradleBuildFile.dependencies
        .filter(dep => dep.type !== 'testImplementation')
        .map((dep): IDepNode => ({
          name: `${dep.group === 'com.exactpro.th2' ? 'th2-' : ''}${dep.name}`,
          type: 'jar',
          docker: false
          }))
      includeDependencies(gradleDependencies, { type: 'jar' })
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
      includeDependencies(parsedRequirements, { type: 'py' })
    }
    catch(e){}

    try {
      const pyproject: { data: string } = await axios.get(`https://raw.githubusercontent.com/${repo.owner.login}/${repo.name}/master/pyproject.toml`)
      const parsedProject = toml.parse(pyproject.data)
      const parsedRequirements: IDepNode[] = Object.keys(parsedProject.tool.poetry.dependencies)
        .map((depName): IDepNode => {
          return {
            docker: false,
            name: depName,
            type: 'py'
          }
        })
      includeDependencies(parsedRequirements, { type: 'py' })
    }
    catch(e){}
    
    depEdges.push(...dependencies)
    progressBar.tick({
      repo: repo.name
    })
  })
  await Promise.all(promises)

  return {
    repos: filteredRepos, depNodes, depEdges,
    dockerUsageMap, reposTypesMap
  }
}