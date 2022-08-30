const plantuml = require('plantuml');
import fs from 'fs'

export async function render(plantUml: string){
  const folders = fs.readdirSync('./')
  if (!folders.includes('output')) fs.mkdirSync('output')
  
  fs.writeFileSync('output/schema.puml', plantUml)
  const svg = await plantuml(plantUml)
  fs.writeFileSync('output/schema.svg', svg);
}