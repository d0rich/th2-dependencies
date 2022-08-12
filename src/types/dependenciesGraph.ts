export type Th2RepoType = 'jar' | 'py' | 'jar & py' | 'js'
export interface IDepNode {
  name: string,
  type: Th2RepoType,
  docker: boolean
}

export interface IDepEdge {
  from: IDepNode,
  to: IDepNode,
  type: string
}