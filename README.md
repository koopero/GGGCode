
`gggCode` is a minimal meta-language, inspired by [G-Code](https://en.wikipedia.org/wiki/G-code).


`gggCode` is short for **G**eneral **G**olly **G**ee **Code**. 


## Example

``` 
G0 V1,2,3 ; Comment
```

In this case, `G0` is a **command**


# Usage

The `gggCode` language doesn't do anything out of the box. You will need to add your own commands to create a useful language. Here is an example of a documented `gggCode` language in Typescript:

``` typescript

const commands = {
  "P0": {
    description: "Print a string to output",
    [gggHooks.Value]: ( arg ) => {
      const { machine, code, value } = arg
      switch ( code ) {
        case "S":
          const strings = ["Hello","World!"]
          const string = strings[value]
          if ( string ) {
            machine.output( { comment: string } )
          }
        break
      }
    }
  }
}

const machine = new gggMachine( { commands } )

machine.run( "P0 S0,1")
.then( result => {
  result = gggFormat( result )
})


```

# Language

## Encoding





# Extensions

## gggdx

**ggg** **d**ocumentation e**x**tensions

```
D1
```

## gggvx

**ggg** **v**ariable e**x**tensions

## ggggx

**ggg** **g**raphics e**x**tensions





- While `gggCode` is somewhat compatible with 