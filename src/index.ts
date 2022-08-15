import { build } from './buildGraph'
import { postProcessFunctions, renderFunctions } from './custom'
import { parse } from './parseInfo'
import { render } from './render'
import { IDepEdge, IDepNode } from './types/dependenciesGraph'
import { DiagramOptions, LineType } from './types/plantuml'

async function main(options: { includeExternal: boolean, lineType: LineType }){
  const { repos, depNodes, depEdges,
    dockerUsageMap, reposTypesMap } = await parse()
  postProcessFunctions.commonLibraries(depNodes, depEdges)
  postProcessFunctions.unitedDependencies(depNodes, depEdges)
  const { allEdges, allNodes } = renderFunctions.filter({ allNodes: depNodes, allEdges: depEdges }, { repos, includeExternal: options.includeExternal })
  const plantUml = build(allNodes, allEdges, {lineType: options.lineType})
  await render(plantUml)
}

main({ 
  includeExternal: false,
  lineType: 'curve'
})