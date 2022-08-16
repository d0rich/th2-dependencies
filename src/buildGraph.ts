import nodeTest from "node:test";
import { renderFunctions } from "./custom";
import { IDepEdge, IDepNode, Th2RepoType } from "./types/dependenciesGraph";
import { DiagramOptions } from "./types/plantuml";

const stylesMap = new Map<Th2RepoType, string>()
stylesMap.set("jar", '#fccaa7')
stylesMap.set("py", '#ffeb94')
stylesMap.set('jar & py', '#a0cdfa')
stylesMap.set('js', '#9ffcc8')
stylesMap.set('undefined', '#d7d7d7')

export function build(nodes: IDepNode[], edges: IDepEdge[], options: DiagramOptions = { lineType: 'curve' }){
  const plantUml: string[] = ['@startuml']
  const groupsMap = renderFunctions.group(nodes)
  plantUml.push(...applyStyle(options))
  plantUml.push(...applyLegend())
  for (const [groupName, nodesInGroup] of groupsMap) {
    plantUml.push(...renderGroup(groupName, nodesInGroup, nodes))
  }
  for(const node of nodes){
    plantUml.push(renderNode(node))
  }
  for(const edge of edges){
    plantUml.push(renderEdge(edge))
  }
  plantUml.push('@enduml')
  return plantUml.join('\n')
}

function applyStyle(options: DiagramOptions){
  return [
    'left to right direction',
    `skinparam linetype ${options.lineType}`,
    'skinparam ArrowColor #212121',
    'skinparam AgentBorderColor #212121',
    'skinparam roundCorner 10',
    `sprite $docker [48x48/16] {
000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000
000000000000000000000015555100000000000000000000
00000000000000000000005A889500000000000000000000
000000000000000000000058887500000000000000000000
000000000000000000000058887500000000000000000000
0000000000000006666666A9778500000000010000000000
000000000000001B766B66797785000000001C9000000000
000000000000001B876B8878887500000000635700000000
000000000000001B876B8878887500000000A00920000000
000000000008889C888B889A889B88810000A00382420000
00000000000B445A545A55685576669300009100B768B400
00000000000A777A876B8879887798A30000470000008200
00000000000A777A876B8879887798A300004D0000196000
00000002888D888C888C889B88AA88BA99BA6009A9930000
000000055211111111111111111111111000004800000000
00001505400200000002500000060000000110A000600000
0005CFDCA9CFD86568BFFC8668EFFB86569EFBC89EFA3000
0000000391111111111111111111111111111B0000001000
00000000B000000000000000000000000000930000000000
000000008300000001560000000000000007600000000000
000000001B00000012430000000000000077000000000000
0000000006B8889982000000000000000960000000000000
00000000007500000000000000000003B400000000000000
000000000007800000000000000002A80000000000000000
0000000000003A61000000000027B8100000000000000000
0000000000000049A8655679AB8400000000000000000000
000000000000000000345431000000000000000000000000
000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000
000000000000000000000000000000000000000000000000
}`,

  ]
}

function applyLegend(){
  const legendExamples: IDepNode[] = [
    {name: 'Java/Kotlin artifacts', docker: false, type: 'jar'},
    {name: 'Python artifacts', docker: false, type: 'py'},
    {name: 'Java/Kotlin & Python artifacts', docker: false, type: 'jar & py'},
    {name: 'JavaScript artifacts', docker: false, type: 'js'},
    {name: 'JavaScript artifacts', docker: false, type: 'js'},
    {name: 'Artifacts type is not supported by generator', docker: false, type: 'undefined'},
    {name: 'Artifact has Docker image', docker: true, type: 'undefined'},
  ]
  return renderGroup('Legend', legendExamples, [])
  // const legend: string[] = []
  // legend.push('legend top left')
  // legend.push('|= |= Type |')
  // for (const [repoType, style] of stylesMap) {
  //   legend.push(`|<back:${style}>   </back>| ${repoType} Artifacts |`)
  // }
  // legend.push('endlegend')
  // return legend
}

function deleteUnsupportedSymbols(name: string){
  return name.replace(/[\[\]"']/g, '_')
}

function plantifyName(name: string){
  return deleteUnsupportedSymbols(name.replace(/[-\.:${}() \/\n&]/g, ''))
}

function renderNode(node: IDepNode){
  const nodeName = plantifyName(node.name)
  if (!nodeName) return ''
  return `agent "${node.docker ? '<$docker> ': ''}${deleteUnsupportedSymbols(node.name)}" as ${nodeName} ${stylesMap.get(node.type) || ''}`
}

function renderEdge(edge: IDepEdge) {
  const fromName = plantifyName(edge.from.name)
  const toName = plantifyName(edge.to.name)
  if (!(fromName && toName)) return ''
  return `${fromName} ${renderArrow(edge)} ${toName} ${renderArrowStyle(edge)}: ${edge.type}`
}

function renderArrow(edge: IDepEdge) {
  return renderFunctions.renderArrow(edge) || '..>'
}

function renderArrowStyle(edge: IDepEdge) {
  return renderFunctions.renderArrowStyle(edge) || ''
}

function renderGroup(name: string, nodes: IDepNode[], allNodes: IDepNode[]) {
  const group: string[] = []
  group.push(`package "${name}" {`)
  for (const node of nodes) {
    group.push(`  ${renderNode(node)}`)
    const nodeIndex = allNodes.findIndex(n => n === node)
    if (nodeIndex > -1) allNodes.splice(nodeIndex, 1)
  }
  group.push('}')
  return group
}