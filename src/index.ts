import { parse } from './parseInfo'

async function main(){
  const { repos, dockerUsageMap, reposDepandencies, reposTypesMap } = await parse()
  
}

main()