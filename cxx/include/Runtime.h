#pragma once
#include "./Config.h"
#include "./Machine.h"

#if GGGPX_ENABLE
#include "./Print.h"
#endif
#if GGGGX_ENABLE
#include "./MatrixCommands.h"
#include "./Blit.h"
#endif
#if GGGTX_ENABLE
#include "./FlowCommands.h"
#endif
#if GGGDX_ENABLE
#include "./DocCommands.h"
#endif

namespace ggg {

  // Register the command surface selected by Config.h. Applications with a
  // custom machine may call this from setup(); RuntimeT does it automatically.
  template <class T>
  inline void addConfiguredCommands( MachineT<T> *machine ) {
    #if GGGPX_ENABLE
    machine->addCommand( new PrintNumbersT<T>() );
    machine->addCommand( new PrintStringT<T>() );
    #endif

    #if GGGGX_ENABLE
    machine->addCommand( new MatrixReadT<T>() );
    machine->addCommand( new MatrixWriteT<T>() );
    machine->addCommand( new MatrixBlitT<T>() );
    #endif

    #if GGGTX_ENABLE
    machine->addCommand( new BlockEndT<T>() );
    machine->addCommand( new ConditionalT<T>() );
    machine->addCommand( new ProcedureInitT<T>() );
    machine->addCommand( new ProcedureRunT<T>() );
    machine->addCommand( new AsyncExportT<T>() );
    #endif

    #if GGGDX_ENABLE
    machine->addCommand( new LanguageDescriptionT<T>() );
    machine->addCommand( new LanguageBasicsT<T>() );
    machine->addCommand( new CommandsListT<T>() );
    machine->addCommand( new EnumsListT<T>() );
    #endif
  }

  template <class T = DefaultTraits>
  class RuntimeT : public MachineT<T> {
  public:
    RuntimeT() {
      addConfiguredCommands<T>( this );
    }
  };

  using Runtime = RuntimeT<>;
}
