import { parse } from './parseInfo'

async function main(){
  const { repos, depNodes, 
    dockerUsageMap, reposDepandencies, reposTypesMap } = await parse()
  
}

main()