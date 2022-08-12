import { build } from './buildGraph'
import { parse } from './parseInfo'
import { IDepNode } from './types/dependenciesGraph'

async function main(){
  const { repos, depNodes, reposDepandencies,
    dockerUsageMap, reposTypesMap } = await parse()
  const allNodes: IDepNode[] = [...depNodes]
  for (const [repoName, dependencies] of reposDepandencies) {
    for(const dep of dependencies) {
      if (!allNodes.includes(dep)) allNodes.push(dep)
    }
  }
  build(allNodes, [])
}

main()