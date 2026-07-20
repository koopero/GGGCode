# A Tour of GGGCode

This is the guided path through the language. Every program below is a real, tested
[case](cases.md) — the link after each one jumps to its entry (with diagrams and the exact
output). For the per-command details, see the [command reference](commands.md); for
how it all runs, see the [runtime guide](runtime.md).

A GGGCode program is a sequence of lines. Each line is a **command** (a letter + number,
like `P10`) followed by space-separated **arguments**, each a code letter and its data.
We'll use `P10` — "print numbers" — to echo values so we can see them.

```
P10 V1,2,3        ; -> 1, 2, 3
```

The `V` (value) argument carries a comma list. → [print_list](cases.md#print_list)

---

## 1. Numbers and encodings

Values can be plain decimals (`123`, `-45.67`, `1.23e-4`), but GGGCode's reason for being
is its denser encodings.

**Unitary constants** are single-token numbers:

```
P10 Vπ            ; -> 3.141592653589793
```
→ [unitary_pi](cases.md#unitary_pi). Also `K`=1, `Z`=0, `N`=−1, `τ`, `e`, `φ`, `γ`.

**Hex** comes in a family. Beyond the plain integer `0X1F`, the *normalized* forms map hex
digits onto the 0..1 range — ideal for pixel/colour data:

```
P10 V0H80         ; -> 0.502   (two nibbles, 0x80/0xFF)
```
→ [hexnorm2_80](cases.md#hexnorm2_80). The reference renders these as brightness swatches,
so you can see the quantization steps. (`0J` is the 1-nibble, 16-step version; `0I`/`0G`
are fixed-width hex *lists*.)

---

## 2. Ranges and sweeps

A range expands one argument into many values — the core of GGGCode's expressiveness.

```
P10 V1:5          ; -> 1, 2, 3, 4, 5   (inclusive)
```
→ [range_incl](cases.md#range_incl). Use `>` for an exclusive end (`1>5` → 1,2,3,4).

Divide a span into a fixed number of points with `/`, or step it with `:step`:

```
P10 V0:10/5       ; -> 0, 2.5, 5, 7.5, 10
```
→ [range_count](cases.md#range_count) (the reference draws this as dots on a number line).
And `0:10:2` → 0,2,4,6,8,10 → [range_step](cases.md#range_step).

The `|` operator builds **multi-axis** values that combine coordinate-wise:

```
P10 V1|2|3        ; -> 6   (lone axes add: 1+2+3)
```
→ [multiaxis](cases.md#multiaxis). With ranges per axis, `|` produces the Cartesian sweep —
see [multiaxis_range](cases.md#multiaxis_range).

---

## 3. References

`$name` reads a named buffer (register). The tour's reference cases use a fixture register
`r` = `[10, 20, 30]`.

```
P10 V$r           ; -> 10, 20, 30   (whole buffer)
P10 V$r[1]        ; -> 20           (one index)
```
→ [ref_bare](cases.md#ref_bare), [ref_subscript](cases.md#ref_subscript). Subscripts take
ranges and multi-axis too (`$r[0:2]`, `$r[a|b]`), and `$name@[...]` yields flat *offsets*
instead of values — see the [references](cases.md#references) and
[offset](cases.md#offset) tags.

---

## 4. Matrix buffers

Buffers are the typed, multi-dimensional registers GGGCode reads and writes. `G20` writes,
`G10` reads back:

```
G20 R0 P0 V7,8,9  ; write 7,8,9 at offset 0 of register 0
G10 R0 P0 S3      ; -> 7, 8, 9
```
→ [matrix_write_read](cases.md#matrix_write_read). `R` selects the register, `P` the offset,
`S` the size to read.

A `Q` operator combines instead of overwriting:

```
G20 R0 P0 Q"add" V5,5,5   ; add 5 into each cell of [10,20,30]
G10 R0 P0 S3              ; -> 15, 25, 35
```
→ [op_add](cases.md#op_add). Also `sub`, `mult`, `min`, `max`, `neg`, `sqrt`
([operator](cases.md#operator)).

---

## 5. Blit — transform-copy

`G40` copies one buffer into another through a spatial transform: scale, flip, rotate,
transpose, with sampling filters and edge modes. This is where the visual reference earns
its keep. The fixture source `bs` is the 3×3 grid `1..9`.

A **box** transform selects a source rectangle and stretches it to fill the destination.
Running its range backwards flips an axis:

```
G40 R"bs" W"bd" T"box" M2.5,-0.5,0,3 F1   ; reverse axis 0 = mirror left/right
G10 R"bd"                                  ; -> 3,2,1, 6,5,4, 9,8,7
```

![blit_box_flip_x](img/blit_box_flip_x.svg)

→ [blit_box_flip_x](cases.md#blit_box_flip_x). The shared colours make the mirror obvious.

A **map** transform points each destination axis at a source axis — swap them to transpose:

```
G40 R"bs" W"bd" T"map" M1,0,3,0,0,3 F1     ; dest0<-src1, dest1<-src0
G10 R"bd"                                  ; -> 1,4,7, 2,5,8, 3,6,9
```

![blit_map_transpose](img/blit_map_transpose.svg)

→ [blit_map_transpose](cases.md#blit_map_transpose). The full set — magnify/minify,
rotate, filters (`F`), edges (`E`), and write operators (`Q`) — is under the
[blit](cases.md#blit) tag.

---

## 6. Flow control

The `gggtx` subsystem adds blocks closed by `T0`.

A **conditional** (`T9`) runs its block once when a condition holds — `A` = all values
truthy, `Y` = any:

```
T9 A1
P10 V42
T0                ; -> 42  (A1 is truthy, so the block runs)
```
→ [cond_all_true](cases.md#cond_all_true).

**Iteration** (`T9 V…`) runs the body once per value, exposing it through a register:

```
T9 V5 R"it"
P10 V$it
T0                ; -> 5
```
→ [iter_single](cases.md#iter_single).

**Procedures** capture a body with `T10` and replay it with `T11`:

```
T10 L"p"
P10 V42
T0
T11 L"p"          ; -> 42
```
→ [flow_define_run](cases.md#flow_define_run). More under the [flow](cases.md#flow) tag.

---

## Where to next

- Browse every feature with diagrams in the [cases reference](cases.md).
- Look up a command's arguments in the [command reference](commands.md).
- Understand the machine, parser, and hooks in the [runtime guide](runtime.md).
