
export interface IDepNode {
  name: string,
  type: 'jar' | 'py' | 'jar & py',
  docker: boolean
}

export interface IDepEdge {
  from: IDepNode,
  to: IDepNode,
  type: string
}