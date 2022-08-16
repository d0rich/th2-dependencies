import { IDepEdge, IDepNode } from "./types/dependenciesGraph"
import { Repositories, Repository } from "./types/github"

export const renderFunctions = {
  filter({ allNodes, allEdges }: { allNodes: IDepNode[], allEdges: IDepEdge[] },
      { repos, includeExternal }: { repos: Repositories, includeExternal: boolean }){
    if (includeExternal) return {allNodes, allEdges}
    const reposNames = repos.map(repo => repo.name)
    reposNames.push('sailfish-common', 'sailfish-core', 'sailfish-service')
    return {
      allNodes: allNodes.filter(node => reposNames.some(repo => repo === node.name)),
      allEdges: allEdges
                      .filter(edge => reposNames.some(repo => repo === edge.from.name))
                      .filter(edge => reposNames.some(repo => repo === edge.to.name))
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
    const scriptUtils = [ 'th2-common-utils-py', 'th2-data-services', 'th2-data-services-utils', 'th2-common-py' ]
    groupsMap.set('Python Script Utils', allNodes.filter(node => scriptUtils.includes(node.name)))
    return groupsMap
  },
  renderArrow(edge: IDepEdge) {
    if (edge.from.name.startsWith('th2-common')) return '.u.>'
    if (!edge.from.name.startsWith('th2') && edge.from.name !== 'remotehand' && !edge.from.name.startsWith('sailfish')) return '....>'
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
      .filter(repo => ![ '.github', 'th2-documentation', 'th2-infra', 'th2-net.github.io' ].includes(repo.name))
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
  th2Sources(nodes: IDepNode[], edges: IDepEdge[]){
    const th2BomNode = nodes.find(node => node.name === 'th2-bom')
    if (!th2BomNode) return
    edges
      .filter(edge => edge.from === th2BomNode)
      .forEach(edge => {
        const edgeIndex = edges.findIndex(e => e === edge)
        if (edgeIndex > -1) {
          edges.splice(edgeIndex, 1)
        }
      })
    const th2GrpcServiceGeneratorNode = nodes.find(node => node.name === 'th2-grpc-service-generator')
    const th2GrpcCommonNode = nodes.find(node => node.name === 'th2-grpc-common')
    const th2GrpcGeneratorTemplateNode = nodes.find(node => node.name === 'th2-grpc-generator-template')
    if (!(th2GrpcCommonNode && th2GrpcGeneratorTemplateNode && th2GrpcServiceGeneratorNode)) return
    edges
      .filter(edge => edge.from === th2GrpcServiceGeneratorNode)
      .forEach(edge => {
        const edgeIndex = edges.findIndex(e => e === edge)
        if (edgeIndex > -1) {
          edges.splice(edgeIndex, 1)
        }
      })
    edges.push({ from: th2BomNode, to: th2GrpcServiceGeneratorNode, type: 'jar' })
    edges.push({ from: th2BomNode, to: th2GrpcCommonNode, type: 'jar' })
    edges.push({ from: th2BomNode, to: th2GrpcGeneratorTemplateNode, type: 'jar' })
    edges.push({ from: th2GrpcServiceGeneratorNode, to: th2GrpcCommonNode, type: 'Gradle plugin' })
    edges.push({ from: th2GrpcGeneratorTemplateNode, to: th2GrpcCommonNode, type: 'Git fork' })
    const th2PythonServiceGeneratedNode = nodes.find(node => node.name === 'th2-python-service-generator')
    if (!th2PythonServiceGeneratedNode) return
    edges.push({ from: th2PythonServiceGeneratedNode, to: th2GrpcGeneratorTemplateNode, type: 'docker image for build' })
  },
  storesCommon(nodes: IDepNode[], edges: IDepEdge[]){
    const th2StoreCommonNode = nodes.find(node => node.name === 'th2-store-common')
    const th2EstoreNode = nodes.find(node => node.name === 'th2-estore')
    const th2MstoreNode = nodes.find(node => node.name === 'th2-mstore')
    if (!(th2EstoreNode && th2MstoreNode && th2StoreCommonNode)) return
    edges.push({ from: th2StoreCommonNode, to: th2EstoreNode, type: 'jar' })
    edges.push({ from: th2StoreCommonNode, to: th2MstoreNode, type: 'jar' })
  },
  sailfish(nodes: IDepNode[], edges: IDepEdge[]){
    const th2SailfishUtilsNode = nodes.find(node => node.name === 'th2-sailfish-utils')
    const sailfishCommonNode = nodes.find(node => node.name === 'sailfish-common')
    const sailfishCoreNode = nodes.find(node => node.name === 'sailfish-core')
    const sailfishServiceNode: IDepNode = { name: 'sailfish-service', docker: false, type: 'jar' }
    console.log(th2SailfishUtilsNode, sailfishCommonNode, sailfishCoreNode)
    if (!(th2SailfishUtilsNode && sailfishCommonNode && sailfishCoreNode)) return
    nodes.push(sailfishServiceNode)
    edges.push({from: sailfishCommonNode, to: sailfishCoreNode, type: 'jar'})
    edges.push({from: sailfishCoreNode, to: th2SailfishUtilsNode, type: 'jar'})
    edges.push({from: sailfishCoreNode, to: sailfishServiceNode, type: 'jar'})
    const th2CodecGenericNode = nodes.find(node => node.name === 'th2-codec-generic')
    const th2ConnGenericNode = nodes.find(node => node.name === 'th2-conn-generic')
    if (!(th2CodecGenericNode && th2ConnGenericNode)) return
    edges.push({from: sailfishServiceNode, to: th2CodecGenericNode, type: 'jar'})
    edges.push({from: sailfishServiceNode, to: th2ConnGenericNode, type: 'jar'})
  },
  generics(nodes: IDepNode[], edges: IDepEdge[]){
    const th2CodecGenericNode = nodes.find(node => node.name === 'th2-codec-generic')
    const th2CodecNode = nodes.find(node => node.name === 'th2-codec')
    const th2ConnGenericNode = nodes.find(node => node.name === 'th2-conn-generic')
    const th2ConnNode = nodes.find(node => node.name === 'th2-conn')
    if (!(th2CodecGenericNode && th2ConnGenericNode && th2CodecNode && th2ConnNode)) return
    edges.push({ from: th2ConnNode, to: th2ConnGenericNode, type: 'docker image base' })
    edges.push({ from: th2CodecNode, to: th2CodecGenericNode, type: 'docker image base' })
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