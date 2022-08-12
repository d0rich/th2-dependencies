import 'dotenv/config'

import { Octokit, App } from "octokit"
import axios from 'axios'
import ProgressBar from 'progress'
import { IGradleDependency } from './types/gradleDependencies'
import { IDepNode } from './types/dependenciesGraph'
const g2js = require('gradle-to-js/lib/parser')
let progressBar: ProgressBar
let promises: Promise<any>[]

const octokit = new Octokit({
  auth: process.env.GH_TOKEN
})

async function main(){
  const th2Net = await octokit.rest.orgs.get({ org: 'th2-net' })
  console.log('all repos in th2-net', th2Net.data.public_repos)

  const REPOS_PER_PAGE = 100
  const repoExample = (await octokit.rest.repos.listForOrg({ org: 'th2-net' })).data[0]
  
  const repos: (typeof repoExample)[] = []
  const commitsCounts = new Map<string, number>()
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

  const filteredRepos = repos
    .filter(repo => ![ '.github', 'th2-documentation', 'th2-infra' ].includes(repo.name))
    .filter(repo => !repo.name.includes('demo'))
    .filter(repo => !repo.name.includes('test'))
    .filter(repo => (commitsCounts.get(repo.name) || 0) > 1)
  console.log('repos after filter:', filteredRepos.length)

  //Get dependencies

  progressBar = new ProgressBar('Getting dependencies [:bar] :repo', {
    total: filteredRepos.length,
    width: 20
  })
  promises = filteredRepos.map(async repo => {
    let dependencies: IDepNode[] = []
    if (['Kotlin', 'Java'].includes(repo.language || '')) {
      const gradleBuildFile = await axios.get(`https://raw.githubusercontent.com/${repo.owner.login}/${repo.name}/master/build.gradle`)
      const parsedGradleBuildFile: { dependencies: IGradleDependency[] | undefined } = await g2js.parseText(gradleBuildFile.data)
      if (parsedGradleBuildFile?.dependencies) {
        dependencies = parsedGradleBuildFile.dependencies
          .filter(dep => dep.group === 'com.exactpro.th2')
          .map((dep): IDepNode => ({
            name: `th2-${dep.name}`,
            type: 'jar',
            docker: false
            }))
      }
      
    }
    
    reposDepandencies.set(repo.name, dependencies)
    progressBar.tick({
      repo: repo.name
    })
  })
  await Promise.all(promises)


  const grpcRepos = filteredRepos.filter(repo => repo.name.startsWith('th2-grpc'))
  const infraRepos = filteredRepos.filter(repo => repo.name.startsWith('th2-infra'))
  console.log('grpc repos:', grpcRepos.map(repo => ({
    repo: repo.name,
    commits: commitsCounts.get(repo.name)
  })))
  console.log('infra repos:', infraRepos.map(repo => repo.name))
  
}

main()