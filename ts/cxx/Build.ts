
type BuildProgram = {
  rootDir: string
  buildDir: string
}

function cxxMainSource( program:BuildProgram ) {
  return `
#include <iostream>
int main() {
  std::cout << "Hello, World!" << std::endl;
  return 0;
}
`
}

async function BuildCxxDir( program:BuildProgram ) {

}