
import { isString } from "../common/util"
import { GGG, GGGFail, Hooks, Command, Commands, CommandDecision, ArgType, HookArgs } from "../ggg/Language"

const gggtxFlowPrefix = "T"

export enum gggtxCodes {
  BlockEnd = `${gggtxFlowPrefix}0`,
  Conditional = `${gggtxFlowPrefix}9`,
  ProcedureInit = `${gggtxFlowPrefix}10`,
  ProcedureRun = `${gggtxFlowPrefix}11`,
  AsyncExport = `${gggtxFlowPrefix}12`,
}

// --- Flow control: procedures via the command gate ---------------------
//
// T10 L"name" opens a capture frame; every following command is stored as raw
// source until the matching T0; T11 L"name" re-enqueues that source to run.
// The frame carries a depth counter so a nested T10/T0 pair is captured as text
// rather than terminating the outer definition. The machine appends captured
// source to frame.capture (see Machine.execLine); this hook decides run vs
// capture vs skip and commits the body on close.

// Marker object used as the register-class key for procedure bodies. Bodies are
// addressable by both R index and L name through the shared NamedList.
export const TProcedure = { name: "TProcedure" }

type ProcedureRegister = {
  name?: string
  index?: number
  lines: string[]
}

const procedureNameHookValue = ( args:HookArgs ) => {
  const { state, code, value } = args
  if ( code === GGG.Alias && isString( value ) ) {
    state.procName = value
  }
}

// Commands that open a T0-terminated block. During capture, a nested opener
// bumps the frame depth so its matching T0 is captured rather than closing the
// outer frame.
const isBlockOpener = ( command:string ) =>
  command === gggtxCodes.ProcedureInit || command === gggtxCodes.Conditional

// Shared capture-frame gate (the T10/T9 Hooks.Stack brain). Captures every
// command into the frame body, tracking nested block depth; at the matching T0
// (depth 0) it runs onClose, pops the frame, and consumes the T0.
const captureGate = ( args:HookArgs, onClose:( machine:any, frame:any ) => void ) => {
  const { machine, command, frame } = args
  if ( command === gggtxCodes.BlockEnd ) {
    if ( ( frame.depth || 0 ) === 0 ) {
      onClose( machine, frame )
      machine.popFrame()
      return CommandDecision.Skip
    }
    frame.depth--
    return CommandDecision.Capture
  }
  if ( isBlockOpener( command ) ) {
    frame.depth = ( frame.depth || 0 ) + 1
  }
  return CommandDecision.Capture
}

const ProcedureInitCommand : Command = {
  description: "Define a procedure; capture following lines until T0",
  args: {
    [GGG.Alias]: { description: "procedure name", type: ArgType.String },
  },
  [Hooks.Command]: ( args ) => { args.state.procName = null },
  [Hooks.Value]: procedureNameHookValue,
  [Hooks.End]: ( args ) => {
    const { machine, state } = args
    const list = machine.getRegisterList( TProcedure )
    const name = state.procName
    // NB: NamedList.get() falls back to list[0] for an unknown string key, so
    // look bodies up by name directly to tell "missing" apart from index 0.
    let reg = name != null ? list.named[name] : null
    if ( !reg ) {
      reg = { lines: [] } as ProcedureRegister
      list.add( reg, name != null ? { name } : undefined )
    } else {
      reg.lines = []   // redefine overwrites silently
    }
    machine.pushFrame( {
      command: ProcedureInitCommand,
      state: { reg },
      capture: [],
      depth: 0,
    } )
  },
  // Command gate: capture the body, commit it to the register at the close.
  [Hooks.Stack]: ( args ) => captureGate( args, ( _machine, frame ) => {
    frame.state.reg.lines = frame.capture.slice()
  } ),
}

// T9: the block combinator. With V it iterates the body once per value (writing
// each into the R register so the body can read it as $name/$index); otherwise
// it is a one-shot conditional (A = all values truthy, Y = any). The body is
// always captured first (so nested blocks compose).
const ConditionalCommand : Command = {
  description: "Block combinator: V iterates, A/Y run once if a condition holds",
  args: {
    "A": { description: "run if all values are truthy", type: ArgType.Number },
    "Y": { description: "run if any value is truthy", type: ArgType.Number },
    [GGG.Value]: { description: "iterate the body once per value", type: ArgType.Number },
    [GGG.Register]: { description: "iteration register (name or index)", type: ArgType.Any },
  },
  [Hooks.Command]: ( args ) => {
    const { state } = args
    state.condA = null
    state.condY = null
    state.iterValues = []
    state.iterReg = undefined
  },
  [Hooks.Value]: ( args ) => {
    const { state, code, value } = args
    const truthy = ( typeof value === "number" ) && value !== 0
    if ( code === "A" ) state.condA = ( state.condA === null ? true : state.condA ) && truthy
    else if ( code === "Y" ) state.condY = ( state.condY === null ? false : state.condY ) || truthy
    else if ( code === GGG.Value && typeof value === "number" ) state.iterValues.push( value )
    else if ( code === GGG.Register ) state.iterReg = value
  },
  [Hooks.End]: ( args ) => {
    const { machine, state } = args
    if ( state.iterValues.length ) {
      // Iteration mode.
      machine.pushFrame( {
        command: ConditionalCommand,
        state: { iter: true, values: state.iterValues.slice(), reg: state.iterReg },
        capture: [],
        depth: 0,
      } )
      return
    }
    // Conditional mode.
    let bool = true
    if ( state.condA !== null ) bool = bool && state.condA
    if ( state.condY !== null ) bool = bool && state.condY
    if ( state.condA === null && state.condY === null ) bool = false  // no condition → skip
    machine.pushFrame( {
      command: ConditionalCommand,
      state: { iter: false, bool },
      capture: [],
      depth: 0,
    } )
  },
  [Hooks.Stack]: ( args ) => captureGate( args, ( machine, frame ) => {
    const { state } = frame
    if ( state.iter ) {
      machine.enqueueLoop( state.values, frame.capture, state.reg )
    } else if ( state.bool ) {
      machine.enqueueLines( frame.capture )
    }
  } ),
}

const ProcedureRunCommand : Command = {
  description: "Run a procedure by name",
  args: {
    [GGG.Alias]: { description: "procedure name", type: ArgType.String },
  },
  [Hooks.Command]: ( args ) => { args.state.procName = null },
  [Hooks.Value]: procedureNameHookValue,
  [Hooks.End]: ( args ) => {
    const { machine, state } = args
    const list = machine.getRegisterList( TProcedure )
    const reg = state.procName != null ? list.named[state.procName] : null
    if ( reg && reg.lines ) {
      machine.enqueueLines( reg.lines )
    } else {
      machine.outputFail( GGGFail.ProcedureNotFound )
    }
  },
}

// T12: export a procedure as asynchronous. The body is not run here -- it is
// handed to the machine's schedule, and the HOST runs it by calling poll(). That
// is how the language gets unbounded repetition without owning a loop: a runaway
// export consumes host ticks, which the host can simply stop granting, rather
// than spinning inside the parser.
const AsyncExportCommand : Command = {
  description: "Export a procedure to run asynchronously on the host's schedule",
  args: {
    [GGG.Alias]: { description: "procedure name", type: ArgType.String },
    [GGG.Size]: { description: "interval in milliseconds", type: ArgType.Number },
    [GGG.Repeat]: { description: "run count; omit for unbounded, 0 cancels", type: ArgType.Number },
  },
  [Hooks.Command]: ( args ) => {
    const { state } = args
    state.procName = null
    state.asyncInterval = 0
    state.asyncCount = undefined
  },
  [Hooks.Value]: ( args ) => {
    const { state, code, value } = args
    procedureNameHookValue( args )
    if ( code === GGG.Size && typeof value === "number" ) state.asyncInterval = value
    else if ( code === GGG.Repeat && typeof value === "number" ) state.asyncCount = value
  },
  [Hooks.End]: ( args ) => {
    const { machine, state } = args
    const list = machine.getRegisterList( TProcedure )
    const name = state.procName
    const reg = name != null ? list.named[name] : null
    if ( !reg || !reg.lines ) {
      machine.outputFail( GGGFail.ProcedureNotFound )
      return
    }
    machine.scheduleProcedure( name, reg, state.asyncInterval, state.asyncCount )
  },
}

export const gggtxFlowCommands : Commands = {
  [gggtxCodes.BlockEnd]: {
    description: "End of block",
  },
  [gggtxCodes.Conditional]: ConditionalCommand,
  [gggtxCodes.ProcedureInit]: ProcedureInitCommand,
  [gggtxCodes.ProcedureRun]: ProcedureRunCommand,
  [gggtxCodes.AsyncExport]: AsyncExportCommand,
}

const gggtxCommands = {
  ...gggtxFlowCommands,
}

export default gggtxCommands