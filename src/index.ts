import 'dotenv/config'

import { Octokit, App } from "octokit"
import ProgressBar from 'progress'
let progressBar: ProgressBar
let promises: Promise<any>[]

const octokit = new Octokit({
  auth: process.env.GH_TOKEN
})

async function main(){
  const th2Net = await octokit.rest.orgs.get({ org: 'th2-net' })
  console.log(th2Net.data.public_repos)

  const REPOS_PER_PAGE = 100
  const repoExample = (await octokit.rest.repos.listForOrg({ org: 'th2-net' })).data[0]
  
  const repos: (typeof repoExample)[] = []
  const commitsCounts = new Map<string, number>()
  for (let i = 0; i * REPOS_PER_PAGE < th2Net.data.public_repos; i ++) {
    repos.push(...(await octokit.rest.repos.listForOrg({ org: 'th2-net', per_page: REPOS_PER_PAGE, page: i + 1})).data)
  }
  
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

  const filteredRepos = repos
    .filter(repo => ![ '.github', 'th2-documentation' ].includes(repo.name))
    .filter(repo => !repo.name.includes('demo'))
    .filter(repo => !repo.name.includes('test'))
    .filter(repo => (commitsCounts.get(repo.name) || 0) > 1)
  console.log(filteredRepos.length)
  console.log(filteredRepos.map(repo => ({
    repo: repo.name,
    commits: commitsCounts.get(repo.name),
    generatedFrom: repo.template_repository
  })))

  const grpcRepos = filteredRepos.filter(repo => repo.name.startsWith('th2-grpc'))
  //console.log(grpcRepos.map(repo => repo.name))
  
}

main()