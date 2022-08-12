import 'dotenv/config'

import { Octokit, App } from "octokit"

const octokit = new Octokit({
  auth: process.env.GH_TOKEN
})

async function main(){
  const th2Net = await octokit.rest.orgs.get({ org: 'th2-net' })
  console.log(th2Net.data.public_repos)
  const repos_per_page = 100
  const repos = (await octokit.rest.repos.listForOrg({ org: 'th2-net', per_page: repos_per_page })).data
  for (let i = 1; i * repos_per_page < th2Net.data.public_repos; i ++) {
    repos.push(...(await octokit.rest.repos.listForOrg({ org: 'th2-net', per_page: repos_per_page, page: i + 1})).data)
  }
  const filteredRepos = repos
    .filter(repo => ![ '.github', 'th2-documentation' ].includes(repo.name))
    .filter(repo => !repo.name.includes('demo'))
  console.log(filteredRepos.length)
  console.log(filteredRepos.map(repo => repo.name))

  const grpcRepos = filteredRepos.filter(repo => repo.name.startsWith('th2-grpc'))
  console.log(grpcRepos.map(repo => repo.name))
  
}

main()