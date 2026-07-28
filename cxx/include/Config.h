#pragma once

// Compile-time runtime composition. Applications may override any flag with a
// numeric -D...=0/1 build definition. Defaults preserve the full historical
// runtime.
#ifndef GGGPX_ENABLE
#define GGGPX_ENABLE 1
#endif

#ifndef GGGGX_ENABLE
#define GGGGX_ENABLE 1
#endif

#ifndef GGGTX_ENABLE
#define GGGTX_ENABLE 1
#endif

#ifndef GGGDX_ENABLE
#define GGGDX_ENABLE 1
#endif

// Circular trigonometry is a semantic graphics/operator capability. CORDIC is
// its fixed-point implementation; floating-point traits continue to use libm.
#ifndef GGGGX_TRIG_ENABLE
#define GGGGX_TRIG_ENABLE GGGGX_ENABLE
#endif

#ifndef GGGGX_CORDIC_ENABLE
#define GGGGX_CORDIC_ENABLE GGGGX_TRIG_ENABLE
#endif

#if GGGGX_TRIG_ENABLE && !GGGGX_ENABLE
#error "GGGGX_TRIG_ENABLE requires GGGGX_ENABLE"
#endif

#if GGGGX_CORDIC_ENABLE && !GGGGX_TRIG_ENABLE
#error "GGGGX_CORDIC_ENABLE requires GGGGX_TRIG_ENABLE"
#endif
