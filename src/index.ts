import { build } from './buildGraph'
import { postProcessFunctions, renderFunctions } from './custom'
import { parse } from './parseInfo'
import { render } from './render'
import { IDepEdge, IDepNode } from './types/dependenciesGraph'

async function main(){
  const { repos, depNodes, depEdges,
    dockerUsageMap, reposTypesMap } = await parse()
  postProcessFunctions.commonLibraries(depNodes, depEdges)
  postProcessFunctions.unitedDependencies(depNodes, depEdges)
  const { allEdges, allNodes } = renderFunctions.filter({ allNodes: depNodes, allEdges: depEdges }, { repos })
  const plantUml = build(allNodes, allEdges, {lineType: 'curve'})
  await render(plantUml)
}

main()