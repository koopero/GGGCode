#pragma once
#include "./Config.h"
#if GGGDX_ENABLE
#include <type_traits>
#include "./Command.h"
#include "./Machine.h"
#include "./Format.h"
#include "./gen/EnumRepository.h"
#include "./gen/DocProtocol.h"
#include "./gen/LanguageBasics.h"

namespace ggg {

  inline String docCommandCode( DocRequest request ) {
    return String( "D" ) + std::to_string( (Int) request );
  }

  inline String docCommandResultCode( CommandResultRecord record ) {
    return String( "D" ) + std::to_string( (Int) record );
  }

  inline String docEnumResultCode( EnumResultRecord record ) {
    return String( "D" ) + std::to_string( (Int) record );
  }

  inline String docBasicsResultCode( BasicsResultRecord record ) {
    return String( "D" ) + std::to_string( (Int) record );
  }

  inline String docStringArg( Char code, const String &value ) {
    return String( 1, code ) + FormatString( value );
  }

  inline String docIntegerArg( Char code, Int value ) {
    return String( 1, code ) + std::to_string( value );
  }

  template <class T>
  inline void addCoreProtocolDomains( CommandTypeT<T> *command ) {
    command->addDomain( EnumGroupIndex::EnumGroup );
    command->addDomain( EnumGroupIndex::CommandResultRecord );
    command->addDomain( EnumGroupIndex::EnumResultRecord );
    command->addDomain( EnumGroupIndex::ArgumentKind );
    command->addDomain( EnumGroupIndex::EnumDomainKind );
    command->addDomain( EnumGroupIndex::Failure );
    command->addDomain( EnumGroupIndex::MessageKind );
    command->addDomain( EnumGroupIndex::BasicsResultRecord );
    command->addDomain( EnumGroupIndex::GrammarRuleKind );
    command->addDomain( EnumGroupIndex::GrammarExampleKind );
  }

  // Build the seven non-executable result schemas from the same CommandType
  // metadata D1/D4 use for ordinary commands.
  template <class T>
  inline CommandTypeT<T>* grammarRuleResultRecordSpec() {
    auto *record = new CommandTypeT<T>();
    record->name = docBasicsResultCode( BasicsResultRecord::Rule );
    record->description = "Describes one stable core grammar rule.";
    record->addArg( Alias, "Stable rule name.", "", ArgumentKind::String );
    record->addArg( Storage, "Grammar rule kind.", "", ArgumentKind::Enum,
      (Int) EnumGroupIndex::GrammarRuleKind );
    record->addArg( Value, "Literal token or canonical non-literal form.", "",
      ArgumentKind::String );
    record->addArg( Data, "Rule meaning.", "", ArgumentKind::String );
    return record;
  }

  template <class T>
  inline CommandTypeT<T>* grammarExampleResultRecordSpec() {
    auto *record = new CommandTypeT<T>();
    record->name = docBasicsResultCode( BasicsResultRecord::Example );
    record->description = "Provides one complete valid or invalid GGG source line.";
    record->addArg( Storage, "Valid or invalid example.", "", ArgumentKind::Enum,
      (Int) EnumGroupIndex::GrammarExampleKind );
    record->addArg( Value, "Complete source line; copy valid examples exactly.", "",
      ArgumentKind::String );
    record->addArg( Data, "Explanation.", "", ArgumentKind::String );
    return record;
  }

  template <class T>
  inline CommandTypeT<T>* commandResultRecordSpec() {
    auto *record = new CommandTypeT<T>();
    record->name = docCommandResultCode( CommandResultRecord::Command );
    record->description = "Describes one command or result-record schema.";
    record->addArg( Command, "Command or record code.", "", ArgumentKind::String );
    record->addArg( Storage, "Executable command or non-executable result record.", "",
      ArgumentKind::Enum, (Int) EnumGroupIndex::MessageKind );
    record->addArg( Size, "Number of described arguments.", "", ArgumentKind::Number );
    record->addArg( Data, "Description.", "", ArgumentKind::String );
    return record;
  }

  template <class T>
  inline CommandTypeT<T>* argumentResultRecordSpec() {
    auto *record = new CommandTypeT<T>();
    record->name = docCommandResultCode( CommandResultRecord::Argument );
    record->description = "Describes one argument in a command or result record.";
    record->addArg( Command, "Owning command or record code.", "", ArgumentKind::String );
    record->addArg( Argument, "Argument glyph.", "", ArgumentKind::String );
    record->addArg( Storage, "Argument semantic kind.", "", ArgumentKind::Enum,
      (Int) EnumGroupIndex::ArgumentKind );
    record->addArg( Register, "Named enum/reference domain.", "", ArgumentKind::Reference,
      (Int) EnumGroupIndex::EnumGroup );
    record->addArg( Transform,
      "Canonical non-literal shape label; never copy it as wire punctuation.",
      "", ArgumentKind::String );
    record->addArg( Repeat, "Required flag.", "", ArgumentKind::Boolean );
    record->addArg( Data, "Description.", "", ArgumentKind::String );
    return record;
  }

  template <class T>
  inline CommandTypeT<T>* returnResultRecordSpec() {
    auto *record = new CommandTypeT<T>();
    record->name = docCommandResultCode( CommandResultRecord::Return );
    record->description = "Describes one command returned by another command.";
    record->addArg( Command, "Originating command code.", "", ArgumentKind::String );
    record->addArg( Target, "Returned command code.", "", ArgumentKind::String );
    record->addArg( Data, "Description.", "", ArgumentKind::String );
    return record;
  }

  template <class T>
  inline CommandTypeT<T>* enumGroupResultRecordSpec() {
    auto *record = new CommandTypeT<T>();
    record->name = docEnumResultCode( EnumResultRecord::Group );
    record->description = "Describes one enum/reference group.";
    record->addArg( Register, "Enum group.", "", ArgumentKind::Reference,
      (Int) EnumGroupIndex::EnumGroup );
    record->addArg( Alias, "Stable group name.", "", ArgumentKind::String );
    record->addArg( Size, "Number of populated entries.", "", ArgumentKind::Number );
    record->addArg( Storage, "Fixed enum or live reference table.", "", ArgumentKind::Enum,
      (Int) EnumGroupIndex::EnumDomainKind );
    record->addArg( Data, "Description.", "", ArgumentKind::String );
    return record;
  }

  template <class T>
  inline CommandTypeT<T>* enumEntryResultRecordSpec() {
    auto *record = new CommandTypeT<T>();
    record->name = docEnumResultCode( EnumResultRecord::Entry );
    record->description = "Describes one value in an enum/reference group.";
    record->addArg( Register, "Owning enum group.", "", ArgumentKind::Reference,
      (Int) EnumGroupIndex::EnumGroup );
    record->addArg( Value, "Actual wire value or reference index.", "", ArgumentKind::Number );
    record->addArg( Alias, "Stable value name.", "", ArgumentKind::String );
    record->addArg( Data, "Description.", "", ArgumentKind::String );
    return record;
  }

  template <class T>
  inline void outputLanguageBasics( MachineT<T> *machine ) {
    for ( Index i = 0; i < GrammarRuleDescriptorCount; i++ ) {
      const auto &rule = GrammarRuleDescriptors[i];
      const EnumValueDescriptor *kind = findEnumValue(
        (Int) EnumGroupIndex::GrammarRuleKind, (Int) rule.kind
      );
      String line = docBasicsResultCode( BasicsResultRecord::Rule );
      line += " " + docStringArg( Alias, rule.name );
      line += " " + docStringArg( Storage, kind ? kind->name : "form" );
      line += " " + docStringArg( Value, rule.value );
      line += " " + docStringArg( Data, rule.description );
      line += End;
      machine->output( line );
    }

    for ( Index i = 0; i < GrammarExampleDescriptorCount; i++ ) {
      const auto &example = GrammarExampleDescriptors[i];
      const EnumValueDescriptor *kind = findEnumValue(
        (Int) EnumGroupIndex::GrammarExampleKind, (Int) example.kind
      );
      String line = docBasicsResultCode( BasicsResultRecord::Example );
      line += " " + docStringArg( Storage, kind ? kind->name : "valid" );
      line += " " + docStringArg( Value, example.source );
      line += " " + docStringArg( Data, example.description );
      line += End;
      machine->output( line );
    }
  }

  template <class T>
  inline void outputCommandSpec( MachineT<T> *machine, CommandTypeT<T> *spec,
      MessageKind messageKind ) {
    String line = docCommandResultCode( CommandResultRecord::Command );
    line += " " + docStringArg( Command, spec->name );
    const EnumValueDescriptor *kind = findEnumValue(
      (Int) EnumGroupIndex::MessageKind, (Int) messageKind
    );
    line += " " + docStringArg( Storage, kind ? kind->name : "command" );
    line += " " + docIntegerArg( Size, (Int) spec->args.size() );
    if ( spec->description && spec->description[0] )
      line += " " + docStringArg( Data, spec->description );
    line += End;
    machine->output( line );

    for ( const auto &arg : spec->args ) {
      const EnumValueDescriptor *kind = findEnumValue(
        (Int) EnumGroupIndex::ArgumentKind, (Int) arg.kind
      );
      String argLine = docCommandResultCode( CommandResultRecord::Argument );
      argLine += " " + docStringArg( Command, spec->name );
      argLine += " " + docStringArg( Argument, String( 1, arg.code ) );
      argLine += " " + docStringArg( Storage, kind ? kind->name : "data" );
      if ( arg.domain >= 0 ) {
        const EnumDomainDescriptor *domain = findEnumDomain( arg.domain );
        if ( domain ) argLine += " " + docStringArg( Register, domain->name );
      }
      if ( arg.format && arg.format[0] )
        argLine += " " + docStringArg( Transform, arg.format );
      if ( arg.required ) argLine += " " + docIntegerArg( Repeat, 1 );
      if ( arg.description && arg.description[0] )
        argLine += " " + docStringArg( Data, arg.description );
      argLine += End;
      machine->output( argLine );
    }

    for ( const auto &response : spec->responds ) {
      String returnLine = docCommandResultCode( CommandResultRecord::Return );
      returnLine += " " + docStringArg( Command, spec->name );
      returnLine += " " + docStringArg( Target, response.command );
      if ( response.description && response.description[0] )
        returnLine += " " + docStringArg( Data, response.description );
      returnLine += End;
      machine->output( returnLine );
    }
  }

  template <class T>
  inline void outputCommandCatalog( MachineT<T> *machine ) {
    for ( Index i = 0; ; i++ ) {
      CommandTypeT<T> *command = machine->commands->getByIndex( i );
      if ( !command ) break;
      outputCommandSpec( machine, command, MessageKind::Command );
      for ( auto *record : command->records )
        outputCommandSpec( machine, record, MessageKind::Result );
    }
  }

  // D2 emits stable core grammar facts followed by valid/invalid wire examples.
  template <class T = DefaultTraits>
  class LanguageBasicsT : public CommandTypeT<T> {
  public:
    using Base = CommandTypeT<T>;
    using Base::machine; using Base::name; using Base::description;
    using Base::addRecord;

    LanguageBasicsT() {
      name = docCommandCode( DocRequest::Basics );
      description = "Describe stable core syntax and wire examples.";
      addCoreProtocolDomains<T>( this );
      addRecord( grammarRuleResultRecordSpec<T>() );
      addRecord( grammarExampleResultRecordSpec<T>() );
      this->addResponse(
        docBasicsResultCode( BasicsResultRecord::Rule ),
        "Stable core grammar rule."
      );
      this->addResponse(
        docBasicsResultCode( BasicsResultRecord::Example ),
        "Valid or invalid complete source example."
      );
      this->addResponse( "OK", "Language basics described successfully." );
    }

    void hookFinish() override {
      outputLanguageBasics( machine );
      machine->outputOK();
    }
  };
  using LanguageBasics = LanguageBasicsT<>;

  // D4 emits one D-40 per executable command or result schema, one D-41 per
  // argument, and D-42 return relations, then the normal OK terminator.
  template <class T = DefaultTraits>
  class CommandsListT : public CommandTypeT<T> {
  public:
    using Base = CommandTypeT<T>;
    using Base::machine; using Base::name; using Base::description;
    using Base::addRecord;

    CommandsListT() {
      name = docCommandCode( DocRequest::Commands );
      description = "List command and result-record schemas.";
      addCoreProtocolDomains<T>( this );
      addRecord( commandResultRecordSpec<T>() );
      addRecord( argumentResultRecordSpec<T>() );
      addRecord( returnResultRecordSpec<T>() );
      this->addResponse(
        docCommandResultCode( CommandResultRecord::Command ),
        "Command or result-record schema."
      );
      this->addResponse(
        docCommandResultCode( CommandResultRecord::Argument ),
        "Argument schema."
      );
      this->addResponse(
        docCommandResultCode( CommandResultRecord::Return ),
        "Command-to-command return relation."
      );
      this->addResponse( "OK", "Command schemas listed successfully." );
    }

    void hookFinish() override {
      outputCommandCatalog( machine );
      machine->outputOK();
    }
  };
  using CommandsList = CommandsListT<>;

  template <class T>
  inline bool docEnumValueAvailable( Int group, Int value ) {
    if ( group != (Int) EnumGroupIndex::Operator ) return true;
    #if !GGGGX_TRIG_ENABLE
    if ( ( value >= 22 && value <= 27 ) || value == 37 ) return false;
    #elif !GGGGX_CORDIC_ENABLE
    if constexpr ( !std::is_floating_point<typename T::Number>::value ) {
      if ( value == 22 || value == 23 || value == 27 || value == 37 )
        return false;
    }
    #endif
    return true;
  }

  template <class T>
  inline Index docDynamicDomainCount( MachineT<T> *machine, Int group ) {
    if ( group == (Int) EnumGroupIndex::EnumGroup )
      return (Index) machine->enumDomains.size();
    if ( group == (Int) EnumGroupIndex::MatrixRegister ) {
      Index count = 0;
      while ( machine->registers->getByIndex( count ) ) count++;
      return count;
    }
    #if GGGTX_ENABLE
    if ( group == (Int) EnumGroupIndex::ProcedureRegister ) {
      Index count = 0;
      while ( machine->procedures->getByIndex( count ) ) count++;
      return count;
    }
    #endif
    const EnumDomainDescriptor *domain = findEnumDomain( group );
    if ( !domain ) return 0;
    Index count = 0;
    for ( Index i = 0; i < domain->count; i++ )
      if ( docEnumValueAvailable<T>( group, domain->values[i].value ) ) count++;
    return count;
  }

  template <class T>
  inline void outputEnumEntry( MachineT<T> *machine, Int group, Int value,
      const String &name, const char *description = "" ) {
    String line = docEnumResultCode( EnumResultRecord::Entry );
    line += " " + docIntegerArg( Register, group );
    line += " " + docIntegerArg( Value, value );
    line += " " + docStringArg( Alias, name );
    if ( description && description[0] )
      line += " " + docStringArg( Data, description );
    line += End;
    machine->output( line );
  }

  // D1/D5 publish the machine-scoped NamedList repository using D-50/D-51.
  // Static domains read generated descriptors; live register domains read the
  // same Lists command execution resolves against.
  template <class T>
  inline void outputEnumCatalog( MachineT<T> *machine ) {
    for ( Int group : machine->enumDomains ) {
        const EnumDomainDescriptor *domain = findEnumDomain( group );
        if ( !domain ) continue;
        const EnumValueDescriptor *kind = findEnumValue(
          (Int) EnumGroupIndex::EnumDomainKind, (Int) domain->kind
        );

        String line = docEnumResultCode( EnumResultRecord::Group );
        line += " " + docIntegerArg( Register, group );
        line += " " + docStringArg( Alias, domain->name );
        line += " " + docIntegerArg( Size, docDynamicDomainCount( machine, group ) );
        line += " " + docStringArg( Storage, kind ? kind->name : "enum" );
        if ( domain->description && domain->description[0] )
          line += " " + docStringArg( Data, domain->description );
        line += End;
        machine->output( line );

        if ( group == (Int) EnumGroupIndex::EnumGroup ) {
          for ( Int available : machine->enumDomains ) {
            const EnumDomainDescriptor *entry = findEnumDomain( available );
            if ( entry ) outputEnumEntry(
              machine, group, available, entry->name, entry->description
            );
          }
        } else if ( group == (Int) EnumGroupIndex::MatrixRegister ) {
          for ( Index i = 0; ; i++ ) {
            MatrixBaseT<T> *entry = machine->registers->getByIndex( i );
            if ( !entry ) break;
            outputEnumEntry( machine, group, entry->index, entry->name );
          }
        #if GGGTX_ENABLE
        } else if ( group == (Int) EnumGroupIndex::ProcedureRegister ) {
          for ( Index i = 0; ; i++ ) {
            TProcedure *entry = machine->procedures->getByIndex( i );
            if ( !entry ) break;
            outputEnumEntry( machine, group, entry->index, entry->name );
          }
        #endif
        } else {
          for ( Index i = 0; i < domain->count; i++ ) {
            const auto &entry = domain->values[i];
            if ( !docEnumValueAvailable<T>( group, entry.value ) ) continue;
            outputEnumEntry( machine, group, entry.value, entry.name, entry.description );
          }
        }
    }
  }

  template <class T = DefaultTraits>
  class EnumsListT : public CommandTypeT<T> {
  public:
    using Base = CommandTypeT<T>;
    using Base::machine; using Base::name; using Base::description;
    using Base::addRecord;

    EnumsListT() {
      name = docCommandCode( DocRequest::Enums );
      description = "List named enum and reference domains.";
      addCoreProtocolDomains<T>( this );
      addRecord( enumGroupResultRecordSpec<T>() );
      addRecord( enumEntryResultRecordSpec<T>() );
      this->addResponse(
        docEnumResultCode( EnumResultRecord::Group ),
        "Enum/reference group."
      );
      this->addResponse(
        docEnumResultCode( EnumResultRecord::Entry ),
        "Enum/reference entry."
      );
      this->addResponse( "OK", "Enum domains listed successfully." );
    }

    void hookFinish() override {
      outputEnumCatalog( machine );
      machine->outputOK();
    }
  };
  using EnumsList = EnumsListT<>;

  // D1 is the one-shot language description: D2 basics, the D4 command
  // catalogue, and the D5 enum catalogue followed by one final terminator.
  template <class T = DefaultTraits>
  class LanguageDescriptionT : public CommandTypeT<T> {
  public:
    using Base = CommandTypeT<T>;
    using Base::machine; using Base::name; using Base::description;

    LanguageDescriptionT() {
      name = docCommandCode( DocRequest::Language );
      description = "Describe the language.";
      addCoreProtocolDomains<T>( this );
      this->addResponse(
        docBasicsResultCode( BasicsResultRecord::Rule ),
        "Stable core grammar rule."
      );
      this->addResponse(
        docBasicsResultCode( BasicsResultRecord::Example ),
        "Valid or invalid complete source example."
      );
      this->addResponse(
        docCommandResultCode( CommandResultRecord::Command ),
        "Command or result-record schema."
      );
      this->addResponse(
        docCommandResultCode( CommandResultRecord::Argument ),
        "Argument schema."
      );
      this->addResponse(
        docCommandResultCode( CommandResultRecord::Return ),
        "Command-to-command return relation."
      );
      this->addResponse(
        docEnumResultCode( EnumResultRecord::Group ),
        "Enum/reference group."
      );
      this->addResponse(
        docEnumResultCode( EnumResultRecord::Entry ),
        "Enum/reference entry."
      );
      this->addResponse( "OK", "Language described successfully." );
    }

    void hookFinish() override {
      outputLanguageBasics( machine );
      outputCommandCatalog( machine );
      outputEnumCatalog( machine );
      machine->outputOK();
    }
  };
  using LanguageDescription = LanguageDescriptionT<>;

}; // namespace ggg
#endif
