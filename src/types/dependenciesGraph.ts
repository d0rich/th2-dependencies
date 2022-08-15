export type Th2RepoType = 'jar' | 'py' | 'jar & py' | 'js' | 'cpp' | 'undefined'
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