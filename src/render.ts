const plantuml = require('plantuml');
const nplantuml = require('node-plantuml');
import fs from 'fs'

export async function render(plantUml: string){
  console.log(plantUml)
  fs.writeFileSync('output/schema.puml', plantUml)
  const svg = await plantuml(plantUml)

  var gen = nplantuml.generate("output/schema.puml");
  gen.out.pipe(fs.createWriteStream("output/schema.png"))
  fs.writeFileSync('output/schema.svg', svg);
}