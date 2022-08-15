import { build } from './buildGraph'
import { renderFunctions } from './custom'
import { parse } from './parseInfo'
import { render } from './render'
import { IDepEdge, IDepNode } from './types/dependenciesGraph'

async function main(){
  const { repos, depNodes, reposDepandencies,
    dockerUsageMap, reposTypesMap } = await parse()
  const allNodes: IDepNode[] = [...depNodes]
  for (const [repoName, dependencies] of reposDepandencies) {
    for(const dep of dependencies) {
      if (!allNodes.includes(dep)) allNodes.push(dep)
    }
  }
  const allEdges: IDepEdge[] = []
  for (const [repoName, dependencies] of reposDepandencies) {
    const node = allNodes.find(node => node.name === repoName)
    if(node) {
      for(const dep of dependencies) {
      allEdges.push({
        from: dep,
        to: node,
        type: node.type
      })
    }
    }
    
  }

  const { allEdges: filteredEdges, allNodes: filteredNodes } = renderFunctions.filter({ allNodes, allEdges }, { repos })
  const plantUml = build(filteredNodes, filteredEdges)
  await render(plantUml)
}

main()