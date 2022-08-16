import { IDepEdge, IDepNode } from "./types/dependenciesGraph"
import { Repositories, Repository } from "./types/github"

export const renderFunctions = {
  filter({ allNodes, allEdges }: { allNodes: IDepNode[], allEdges: IDepEdge[] },
      { repos, includeExternal }: { repos: Repositories, includeExternal: boolean }){
    if (includeExternal) return {allNodes, allEdges}
    return {
      allNodes: allNodes.filter(node => repos.some(repo => repo.name === node.name)),
      allEdges: allEdges
                      .filter(edge => repos.some(repo => repo.name === edge.from.name))
                      .filter(edge => repos.some(repo => repo.name === edge.to.name))
    }
  },
  group(allNodes: IDepNode[]): Map<string, IDepNode[]> {
    const groupsMap = new Map<string, IDepNode[]>()
    groupsMap.set('th2-infra', allNodes.filter(node => node.name.startsWith('th2-infra')))
    groupsMap.set('connectors', allNodes.filter(node => node.name.startsWith('th2-conn')))
    groupsMap.set('codecs', allNodes.filter(node => node.name.startsWith('th2-codec')))
    groupsMap.set('th2-act', allNodes.filter(node => node.name.startsWith('th2-act')))
    const coreBoxes = [ 'th2-estore', 'th2-mstore', 'th2-rpt-data-provider', 'th2-rpt-viewer' ]
    groupsMap.set('core', allNodes.filter(node => coreBoxes.includes(node.name)))
    return groupsMap
  },
  renderArrow(edge: IDepEdge) {
    if (edge.from.name.startsWith('th2-common')) return '.u.>'
    if (!edge.from.name.startsWith('th2') && edge.from.name !== 'remotehand') return '....>'
  },
  renderArrowStyle(edge: IDepEdge) {
    if (edge.from.name.startsWith('th2-common')){
      if (edge.from.type === 'py') return '#ffeb94'
      if (edge.from.type === 'jar') return '#fccaa7'
    }
    if (edge.from.name === 'th2-grpc-common') return '#a0cdfa'
    if (edge.from.name === 'th2-sailfish-utils') return '#b0b0b0'
    if (!edge.from.name.startsWith('th2') && edge.from.name !== 'remotehand') return '#d7d7d7'
  }
}

export const parseFunctions = {
  filterRepos(repos: Repositories, options: { commitsCounts: Map<string, number> }){
    return repos
      .filter(repo => ![ '.github', 'th2-documentation', 'th2-infra', 'th2-bom', 'th2-net.github.io' ].includes(repo.name))
      .filter(repo => !repo.name.includes('demo'))
      .filter(repo => !repo.name.includes('test'))
      .filter(repo => (options.commitsCounts.get(repo.name) || 0) > 1)
  }
}

export const postProcessFunctions = {
  commonLibraries(nodes: IDepNode[], edges: IDepEdge[]) {
    nodes.forEach(node => {
      if(node.name === 'th2-common') {
        switch (node.type) {
          case 'py':
            node.name = 'th2-common-py'
            break;
          case 'jar':
            node.name = 'th2-common-j'
            break;
          default:
            break;
        }
      }
      if(node.type === 'jar & py') {
        node.docker = false
      }
    })
  },
  unitedDependencies(nodes: IDepNode[], edges: IDepEdge[]) {
    nodes.forEach(node => {
      const dependencies = edges.filter(edge => edge.to === node)

      const groups = new Map<IDepNode, IDepEdge[]>()
      for (const dep of dependencies) {
        if (!groups.has(dep.from))
          groups.set(dep.from, dependencies.filter(dep2 => dep.from === dep2.from))
      }
      for (const [ nodeFrom, edgesLocal ] of groups) {
        if (edgesLocal.length > 1) {
          const unitedType = edgesLocal.map(edge => edge.type).sort().join(' & ')
          for (const edge of edgesLocal){
            edges.splice(edges.findIndex(e => edge === e), 1)
          }
          edges.push({
            from: nodeFrom,
            to: node,
            type: unitedType
          })
        }
      }
    })
  }
}