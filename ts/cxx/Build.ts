import deindent from 'deindent'

enum BuildFlavour {
  Cling,
  PIO,
}

type cxxCommandType = { command?: string, cxxClass?: string }

type BuildOptions = {
  flavour?: BuildFlavour
  rootDir?: string
  buildDir?: string
  mainStart?: string
  namespace?: string
  commands?: cxxCommandType[]
  machineClassName?: string
}


const cxxMachineClass = ( { 
  machineClassName = "TestMachine", commands
} : BuildOptions ) => `
class ${machineClassName} : public ggg::Machine {
  public:
    void setup() override {
      ${ !commands ? "" : commands.map( command => `addCommand( new ${command.cxxClass}() );` ).join(`
      `)}
    }
  };
`


const cxxMainFunction = (
  { 
    functionName = "main",
    className = "TestMachine", 
  } : {
    functionName: string,
    className: string
  }
) => {
  return deindent`
    void ${functionName}() {
      TestMachine machine;
      machine.setup();
      ggg::Char chr;
      while( (chr = getchar()) != EOF ) {
        machine.input( chr );
      }
    }
  `
}

const cccMainFile = ( {
  className = "TestMachine",
  commands: cxxCommandType[]
})

async function BuildCxxDir( options:BuildOptions ) {

  const { flavour, rootDir, buildDir } = options

  switch( flavour ) {
    case BuildFlavour.Cling:

  }

}