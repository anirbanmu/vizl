import type { AudioAnalysisData, AudioAnalysisMetadata } from '../audio/types';
import { BaseAudioVisualiserGL } from './base-gl';

// configuration
const TUNNEL_SEGMENTS = 32; // depth resolution (rings)
const TUNNEL_RADIUS_BASE = 0.5; // resting radius
const TUNNEL_RADIUS_AMP = 0.8; // bass impact
const TUNNEL_Z_FAR = -3.0; // deep end
const TUNNEL_Z_NEAR = -1.5; // near end

const GAP_DEPTH = 0.3; // ring gap
const GAP_ANGULAR = 0.2; // strip gap

const SPECTRUM_USAGE = 0.7; // spectrum usage
const BASS_REGION = 0.25; // kick region

export class FrequencyRadialVisualiser extends BaseAudioVisualiserGL {
  private dataTexture!: WebGLTexture;
  private gradientTexture!: WebGLTexture;
  private program!: WebGLProgram;

  constructor(canvas: HTMLCanvasElement, metadata: AudioAnalysisMetadata) {
    super(canvas, {
      ...metadata,
      frequencyBinCount: 8 * Math.trunc((SPECTRUM_USAGE * metadata.frequencyBinCount) / 8),
    });

    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    this.gl.enable(this.gl.BLEND);

    this.prepShaders();
    this.resize();
  }

  protected renderFrame(data: AudioAnalysisData): void {
    // 1. update texture
    this.gl.texSubImage2D(
      this.gl.TEXTURE_2D,
      0,
      0,
      0,
      this.frequencyBinCount,
      1,
      this.gl.RED,
      this.gl.FLOAT,
      data.frequencyData,
    );

    // 2. physics
    const scalingDim = this.minDim() / 2;
    const kickEnergy = this.computeKickEnergy(data.frequencyData);
    const tunnelRadius = scalingDim * (TUNNEL_RADIUS_BASE + kickEnergy * TUNNEL_RADIUS_AMP);

    // 3. draw
    this.gl.uniform1f(this.getUniformLocation(this.program, 'uRadius'), tunnelRadius);

    // 6 vertices per quad * rings * bins * 8 octants
    this.gl.drawArraysInstanced(this.gl.TRIANGLES, 0, 6 * TUNNEL_SEGMENTS, this.frequencyBinCount * 8);
  }

  protected onResize(): void {
    const uAspectLoc = this.getUniformLocation(this.program, 'uAspect');
    this.gl.uniform2fv(
      uAspectLoc,
      new Float32Array([2.0 / this.gl.drawingBufferWidth, 2.0 / this.gl.drawingBufferHeight]),
    );

    // 45 degrees per octant
    const angleStep = (Math.PI * 0.25) / this.frequencyBinCount;
    this.gl.uniform1f(this.getUniformLocation(this.program, 'uAngleStep'), angleStep);

    // strip width
    const usableAngle = angleStep * (1.0 - GAP_ANGULAR);
    this.gl.uniform1f(this.getUniformLocation(this.program, 'uHalfAngleWidth'), usableAngle * 0.5);
  }

  private prepShaders(): void {
    const gradientStops = [
      { hex: 0x000000, alpha: 0.0, stop: 0.0 },
      { hex: 0x00d1b1, alpha: 0.3, stop: 0.2 },
      { hex: 0xabe300, alpha: 0.8, stop: 0.5 },
      { hex: 0xff8400, alpha: 1.0, stop: 0.8 },
      { hex: 0xff2d00, alpha: 1.0, stop: 1.0 },
    ];

    this.program = this.createProgram(vertShader, fragShader);
    this.gl.useProgram(this.program);

    // uniforms
    this.gl.uniform1i(this.getUniformLocation(this.program, 'uBins'), this.frequencyBinCount);
    this.gl.uniform1f(this.getUniformLocation(this.program, 'uRings'), TUNNEL_SEGMENTS);
    this.gl.uniform1f(this.getUniformLocation(this.program, 'uZNear'), TUNNEL_Z_NEAR);
    this.gl.uniform1f(this.getUniformLocation(this.program, 'uZFar'), TUNNEL_Z_FAR);
    this.gl.uniform1f(this.getUniformLocation(this.program, 'uGap'), GAP_DEPTH);

    // textures
    const gradData = this.createGradientTexture(gradientStops, 256);
    this.gradientTexture = this.createTexture(1, gradData, this.gl.RGBA, this.gl.UNSIGNED_BYTE, true);
    this.gl.uniform1i(this.getUniformLocation(this.program, 'uGrad'), 1);

    this.dataTexture = this.createTexture(0, null, this.gl.R16F, this.gl.FLOAT, false, this.frequencyBinCount, 1);
    this.gl.uniform1i(this.getUniformLocation(this.program, 'uMag'), 0);
  }

  private createTexture(
    unit: number,
    data: ArrayBufferView | null,
    intFmt: number,
    type: number,
    linear: boolean,
    w = 256,
    h = 1,
  ): WebGLTexture {
    const tex = this.gl.createTexture()!;
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      intFmt,
      w,
      h,
      0,
      intFmt === this.gl.RGBA ? this.gl.RGBA : this.gl.RED,
      type,
      data,
    );
    const filter = linear ? this.gl.LINEAR : this.gl.NEAREST;
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, filter);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, filter);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    return tex;
  }

  private computeKickEnergy(data: Float32Array): number {
    const kickBins = Math.floor(data.length * BASS_REGION);
    let sum = 0;
    for (let i = 0; i < kickBins; i++) sum += data[i];
    return sum / kickBins;
  }
}

const vertShader = `#version 300 es
    precision highp float;

    // ------------------------------------------
    // 3d freq-radial tunnel shader algorithm
    // ------------------------------------------
    // this shader renders a 3d tunnel made of many small quads.
    // hierarchy:
    // 1. the whole tunnel is split into 8 "octants" (like slices of a pizza).
    // 2. each octant is split into 'uBins' angular strips (one per frequency bin).
    // 3. each strip consists of 'uRings' segments deep into the screen.
    //
    // we use instanced rendering:
    // - gl_InstanceID tells us which strip and octant we are drawing.
    // - gl_VertexID tells us which part of the quad (and which depth ring) we are at.
    //
    // the goal is to position each vertex in 3d space (projected to 2d),
    // and color it based on the audio data (uMag) and depth.

    // uniforms
    uniform float uRings;          // num rings
    uniform float uZNear;          // near z
    uniform float uZFar;           // far z
    uniform float uGap;            // ring gap

    uniform int uBins;             // bins per octant

    uniform vec2 uAspect;          // aspect scale
    uniform float uRadius;         // tunnel radius
    uniform float uAngleStep;      // angle per strip
    uniform float uHalfAngleWidth; // half strip width (radians)

    uniform sampler2D uMag;        // magnitudes
    uniform sampler2D uGrad;       // gradient

    // quad offsets used to expand a point into a rectangle.
    // x = depth offset (0.0 = start of ring segment, 1.0 = end of ring segment)
    // y = angle offset (-1.0 = left side of strip, 1.0 = right side of strip)
    //
    // sequence (6 vertices for 2 triangles):
    // BL (0, -1), BR (0, 1), TL (1, -1)
    // TL (1, -1), BR (0, 1), TR (1, 1)
    const vec2 QUAD_OFFSETS[6] = vec2[](
        vec2(0.0, -1.0), vec2(0.0, 1.0), vec2(1.0, -1.0),
        vec2(1.0, -1.0), vec2(0.0, 1.0), vec2(1.0, 1.0)
    );

    out vec4 vColor;

    void main() {
        // identify where we are in the grid
        int octant = gl_InstanceID / uBins;
        int stripIndex = gl_InstanceID % uBins;
        int ringIndex = gl_VertexID / 6;
        int vertexPart = gl_VertexID % 6;

        // 0. culling
        // fetch audio data for this frequency bin
        float magnitude = texelFetch(uMag, ivec2(stripIndex, 0), 0).r;
        float activeRings = magnitude * uRings;

        // simple optimization: don't draw rings that aren't "lit up" by audio
        if (float(ringIndex) >= activeRings) {
            gl_Position = vec4(0.0);
            return;
        }

        // get the expansion offsets for this specific vertex of the quad
        vec2 offsets = QUAD_OFFSETS[vertexPart];

        // 1. angle calc
        // determine the base angle for this specific frequency strip within an octant
        float baseAngle = (float(stripIndex) + 0.5) * uAngleStep;

        float PI = 3.14159265;
        float OCTANT_ANGLE_SPAN = PI * 0.25; // 45 degrees
        float octantStartAngle = float(octant) * OCTANT_ANGLE_SPAN;

        // mirror logic: even octants go forward, odd go backward.
        // this creates the symmetric kaleidoscope effect where adjacent octants match up.
        float isOdd = float(octant & 1);
        float localAngle = mix(baseAngle, OCTANT_ANGLE_SPAN - baseAngle, isOdd);

        // combine everything: octant start + local strip angle + vertex expansion width
        float finalAngle = octantStartAngle + localAngle + (offsets.y * uHalfAngleWidth);

        // 2. depth calc
        // interpolate z-depth based on which ring we are in.
        // offsets.x allows us to create gaps between rings (uGap).
        float zIdx = float(ringIndex) + (offsets.x * (1.0 - uGap));
        float zNorm = zIdx / uRings;
        float z = mix(uZFar, uZNear, zNorm);

        // 3. projection
        // polar to cartesian
        vec2 xy = vec2(cos(finalAngle), sin(finalAngle)) * uRadius;
        // standard perspective divide
        vec2 projected = xy / -z;

        gl_Position = vec4(projected * uAspect, 0.0, 1.0);

        // 4. color
        // sample the gradient texture based on depth (z)
        float activeAlpha = clamp(activeRings - float(ringIndex), 0.0, 1.0);
        float gradientPos = (float(ringIndex) + 0.5) / uRings;
        vec4 color = texture(uGrad, vec2(gradientPos, 0.5));

        vColor = vec4(color.rgb, color.a * activeAlpha);
    }
`;

const fragShader = `#version 300 es
    precision highp float;
    in vec4 vColor;
    out vec4 fragColor;
    void main() { fragColor = vColor; }
`;
