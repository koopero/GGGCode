# GGGCode

GGGCode (General Golly Gee Code) is a minimal meta-language inspired by G-Code, designed for general-purpose command and control applications. It provides a simple yet powerful syntax that can be extended to suit various domains.

## Overview

GGGCode is built around a simple command-line format where each line consists of a command followed by arguments and optional comments. The language is designed to be:

- **Minimal**: Core syntax is simple and easy to learn
- **Extensible**: Build custom commands and behaviors for your specific needs
- **Machine-friendly**: Easy to parse and generate programmatically
- **Human-readable**: Clear, concise syntax that's easy to write and understand
- **Domain-agnostic**: Suitable for various applications beyond traditional G-Code use cases

## Basic Syntax

```
Command Arguments ; Comment
```

Example:
```
G0 V1,2,3      ; Move to position (1,2,3)
P0 S"Hello"    ; Print string "Hello"
```

### Commands

Commands start with a letter and are case-insensitive. The specific commands available depend on your implementation, as GGGCode is designed to be extended with custom commands.

### Arguments

Arguments follow the command and can include:

- **Numbers**: 
  - Decimal: `123`, `-45.67`, `1.23e-4`
  - Hex: `0X1F` (regular hex)
  - Fixed-width hex lists: `0I5A` (1 digit), `0G5A3B` (2 digits)
  - Normalized hex: `0J80` (1 digit), `0H8040` (2 digits)

- **Strings**:
  - Quoted: `"Hello, world!"`
  - To end of line: `` `Rest of line becomes string``

- **Special Constants**:
  - One: `K`
  - Zero: `Z`
  - Minus One: `N`

- **References**: 
  - Basic: `$variable`
  - With subscript: `$array[1,2]`

### Value Modifiers

Values can be modified using:

- **Ranges**: `1:10` (inclusive range)
- **Uninclusive Ranges**: `1>10` (exclusive range)
- **Multipliers**: `5*3` (multiplication)
- **Count**: `1/3` (division/count)
- **Multi-axis**: `1|2|3` (separate axis values)
- **Lists**: `1,2,3` (comma-separated values)

### Comments

Comments start with a semicolon (`;`) and continue to the end of the line:

```
G0 V1 ; This is a comment
```

## Extensions

GGGCode includes several extension systems:

- **gggdx**: Documentation extensions
- **ggggx**: Graphics extensions
- **gggvx**: Variable extensions
- **gggcx**: Custom extensions
- **gggpx**: Processing extensions
- **gggtx**: Text processing extensions

## Implementation

To implement GGGCode in your application:

1. Define your command set:
```typescript
const commands = {
  "P0": {
    description: "Print a string to output",
    [gggHooks.Value]: (arg) => {
      const { machine, code, value } = arg
      switch (code) {
        case "S":
          console.log(value)
          break
      }
    }
  }
}
```

2. Create a machine instance:
```typescript
const machine = new Machine({ commands })
```

3. Run GGGCode:
```typescript
machine.run('P0 S"Hello, World!"')
```

## Use Cases

GGGCode can be used for:

- Machine control and automation
- Graphics and visualization
- Data processing
- Configuration files
- Domain-specific languages
- Command-line interfaces

## Benefits

1. **Simplicity**: Easy to learn and implement
2. **Flexibility**: Extend with custom commands and behaviors
3. **Portability**: Simple text format that works everywhere
4. **Efficiency**: Fast to parse and process
5. **Extensibility**: Add new features through the extension system

## License

ISC License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 