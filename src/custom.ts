import { IDepEdge, IDepNode } from "./types/dependenciesGraph"
import { Repositories, Repository } from "./types/github"

export const renderFunctions = {
  filter({ allNodes, allEdges }: { allNodes: IDepNode[], allEdges: IDepEdge[] },
      { repos }: { repos: Repositories }){
    return {
      allNodes: allNodes.filter(node => repos.some(repo => repo.name === node.name)),
      allEdges: allEdges
                      .filter(edge => repos.some(repo => repo.name === edge.from.name))
                      .filter(edge => repos.some(repo => repo.name === edge.to.name))
    }
  },
  renderArrow(edge: IDepEdge) {
    if (edge.from.name.startsWith('th2-common')) return '.u.>'
  }
}

export const parseFunctions = {
  filterRepos(repos: Repositories, options: { commitsCounts: Map<string, number> }){
    return repos
      .filter(repo => ![ '.github', 'th2-documentation', 'th2-infra', 'th2-bom' ].includes(repo.name))
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
  }
}