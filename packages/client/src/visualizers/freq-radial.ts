import type { AudioAnalysisData, AudioAnalysisMetadata } from '../audio/types';
import { BaseAudioVisualiserGL } from './base-gl';

const FREQUENCY_BAR_DIVS = 32;
const MIN_RADIUS_SCALE = 0.2;
const MAX_RADIUS_SCALE = 0.5;
const BAR_STACK_HEIGHT_SCALE = 0.4;
const STACK_GAP_PERCENTAGE = 0.15; // gap between radial segments
const ANGULAR_GAP_PERCENTAGE = 0.15; // gap between angular bars

const SPECTRUM_USAGE = 0.7; // use 70% of the spectrum
const BASS_REGION_PERCENTAGE = 0.25; // check first 25% for bass intensity
const POWER_CURVE_EXPONENT = 0.6; // power curve for radial distribution

export class FrequencyRadialVisualiser extends BaseAudioVisualiserGL {
  private dataTexture!: WebGLTexture;
  private gradientTexture!: WebGLTexture;
  private program!: WebGLProgram;
  private barDivs = FREQUENCY_BAR_DIVS;
  private radialOffsets!: Float32Array;

  constructor(canvas: HTMLCanvasElement, metadata: AudioAnalysisMetadata) {
    super(canvas, {
      ...metadata,
      // use 70% of the spectrum
      frequencyBinCount: 4 * Math.trunc((SPECTRUM_USAGE * metadata.frequencyBinCount) / 4),
    });

    // pre-calculate radial offsets for the power curve to optimize vertex shader performance
    this.radialOffsets = new Float32Array(this.barDivs + 1);
    const invPower = 1.0 / POWER_CURVE_EXPONENT;
    for (let i = 0; i <= this.barDivs; i++) {
      this.radialOffsets[i] = Math.pow(i / this.barDivs, invPower);
    }

    // blend mode for smooth edges with MSAA
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    this.gl.enable(this.gl.BLEND);

    this.prepShaders();
    this.resize();
  }

  protected renderFrame(data: AudioAnalysisData): void {
    // update frequency data texture
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.dataTexture);
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

    // ensure gradient texture is bound
    this.gl.activeTexture(this.gl.TEXTURE1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.gradientTexture);

    const scalingDim = this.minDim() / 2;
    const freqIntensityFactor = this.computeBassIntensity(data.frequencyData);

    // calculate base radius with breathing effect
    const baseRadius = scalingDim * (MIN_RADIUS_SCALE + freqIntensityFactor * (MAX_RADIUS_SCALE - MIN_RADIUS_SCALE));

    this.gl.useProgram(this.program);

    const baseRadiusLoc = this.getUniformLocation(this.program, 'baseRadius');
    this.gl.uniform1f(baseRadiusLoc, baseRadius);

    // draw instanced quads - one instance per bar
    // vertices per instance = 6 * segments per bar
    const verticesPerInstance = 6 * this.barDivs;
    this.gl.drawArraysInstanced(this.gl.TRIANGLES, 0, verticesPerInstance, this.frequencyBinCount);
  }

  protected onResize(): void {
    // pass inverse dimensions for faster aspect correction in shader (multiplication vs division)
    const uAspectScaleLoc = this.getUniformLocation(this.program, 'uAspectScale');
    this.gl.uniform2fv(
      uAspectScaleLoc,
      new Float32Array([2.0 / this.gl.drawingBufferWidth, 2.0 / this.gl.drawingBufferHeight]),
    );

    const scalingDim = this.minDim() / 2;
    const totalStackHeight = scalingDim * BAR_STACK_HEIGHT_SCALE;

    const uMaxRadiusLoc = this.getUniformLocation(this.program, 'uMaxRadius');
    this.gl.uniform1f(uMaxRadiusLoc, totalStackHeight);

    const uStackGapPercentageLoc = this.getUniformLocation(this.program, 'uStackGapPercentage');
    this.gl.uniform1f(uStackGapPercentageLoc, STACK_GAP_PERCENTAGE);

    // pre-calculate angular logic
    const angleStep = (-2.0 * Math.PI) / this.frequencyBinCount;
    const angularWidth = Math.abs(angleStep);
    const gapAngle = angularWidth * ANGULAR_GAP_PERCENTAGE;
    const usableAngle = angularWidth - gapAngle;
    const halfAngle = usableAngle * 0.5;

    const uHalfAngleLoc = this.getUniformLocation(this.program, 'uHalfAngle');
    this.gl.uniform1f(uHalfAngleLoc, halfAngle);
  }

  private prepShaders(): void {
    const gradientStops = [
      { hex: 0x00d1b1, alpha: 0.0, stop: 0.0 },
      { hex: 0xabe300, alpha: 0.7, stop: 0.2 },
      { hex: 0xff8400, alpha: 1.0, stop: 0.65 },
      { hex: 0xff2d00, alpha: 1.0, stop: 1.0 },
    ];

    const vertexSource = this.templateShader(geometryVertShader, {
      FREQUENCY_BARS: this.frequencyBinCount,
      FREQUENCY_BAR_DIVS: this.barDivs,
    });

    const fragmentSource = geometryFragShader;

    this.program = this.createProgram(vertexSource, fragmentSource);
    this.gl.useProgram(this.program);

    // pass pre-calculated radial offsets
    const uRadialOffsetsLoc = this.getUniformLocation(this.program, 'uRadialOffsets');
    this.gl.uniform1fv(uRadialOffsetsLoc, this.radialOffsets);

    // gradient texture
    const gradientData = this.createGradientTexture(gradientStops, 256);
    this.gradientTexture = this.gl.createTexture()!;
    this.gl.activeTexture(this.gl.TEXTURE1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.gradientTexture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      256,
      1,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      gradientData,
    );
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

    const colorGradientLoc = this.getUniformLocation(this.program, 'colorGradient');
    this.gl.uniform1i(colorGradientLoc, 1);

    // data texture
    this.dataTexture = this.gl.createTexture()!;
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.dataTexture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.R16F,
      this.frequencyBinCount,
      1,
      0,
      this.gl.RED,
      this.gl.FLOAT,
      null,
    );
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

    const magnitudesLoc = this.getUniformLocation(this.program, 'magnitudes');
    this.gl.uniform1i(magnitudesLoc, 0);
  }

  private computeBassIntensity(frequencyData: Float32Array): number {
    let rMultiplier = 0;
    // check the bass region for intensity
    const bassBins = Math.floor(frequencyData.length * BASS_REGION_PERCENTAGE);
    for (let i = 0; i < bassBins; i++) {
      rMultiplier += frequencyData[i];
    }
    return rMultiplier / bassBins;
  }
}

const geometryVertShader = `#version 300 es
    precision highp float;

    // geometry generation algorithm:
    // we generate individual trapezoids for each segment of each bar directly in the vertex shader.
    //
    // 1. we use instanced rendering where each instance is a full bar.
    // 2. we draw 6 vertices (2 triangles) for every segment in the bar.
    // 3. gl_VertexID is used to determine which segment (quadIndex) and which corner (vertexInQuad) we are processing.
    // 4. we calculate the precise polar coordinates (radius, angle) for that corner.
    // 5. gaps are applied by shrinking the geometry logic.
    // 6. the GPU's native MSAA handles the anti-aliasing of the resulting edges.

    uniform vec2 uAspectScale; // [2.0/width, 2.0/height]
    uniform float baseRadius;
    uniform float uMaxRadius;
    uniform float uStackGapPercentage;
    uniform float uHalfAngle; // pre-calculated half angle width
    uniform float uRadialOffsets[FREQUENCY_BAR_DIVS + 1]; // pre-calculated power curve
    uniform sampler2D magnitudes;
    uniform sampler2D colorGradient;

    // constants
    const float PI = 3.14159265359;
    const float TWO_PI = 6.28318530718;

    out vec4 vColor;

    float getMagnitude(int index) {
        return texelFetch(magnitudes, ivec2(index, 0), 0).r;
    }

    void main() {
        int barIndex = gl_InstanceID;
        int totalBars = FREQUENCY_BARS;
        int totalSegments = FREQUENCY_BAR_DIVS;

        // calculate which segment and vertex we are processing
        int quadIndex = gl_VertexID / 6;
        int vertexInQuad = gl_VertexID % 6;
        int segmentIndex = quadIndex;

        // get magnitude for this bar
        float magnitude = getMagnitude(barIndex);
        float activeSegments = magnitude * float(totalSegments);

        // discard if segment is inactive
        // we can't discard in vertex shader, but we can degenerate the triangle
        if (float(segmentIndex) >= activeSegments) {
            gl_Position = vec4(0.0);
            return;
        }

        // --- angular logic ---
        float angleStep = (-2.0 * PI) / float(totalBars);
        float centerAngle = float(barIndex) * angleStep + (angleStep * 0.5);

        float angleStart = centerAngle - uHalfAngle;
        float angleEnd = centerAngle + uHalfAngle;

        // --- radial logic ---
        // use pre-calculated radial offsets
        float normR_Start = uRadialOffsets[segmentIndex];
        float normR_End = uRadialOffsets[segmentIndex + 1];

        // apply radial gap
        // we apply the gap to the normalized radius
        float segmentLen = normR_End - normR_Start;
        float gapLen = segmentLen * uStackGapPercentage;
        normR_End -= gapLen;

        // map to physical radius
        float rStart = baseRadius + normR_Start * uMaxRadius;
        float rEnd = baseRadius + normR_End * uMaxRadius;

        // --- vertex positioning ---
        // quad vertices:
        // 0: BL, 1: BR, 2: TL
        // 3: TL, 4: BR, 5: TR

        float r, a;

        if (vertexInQuad == 0) { r = rStart; a = angleStart; } // BL
        else if (vertexInQuad == 1) { r = rStart; a = angleEnd; }   // BR
        else if (vertexInQuad == 2) { r = rEnd;   a = angleStart; } // TL
        else if (vertexInQuad == 3) { r = rEnd;   a = angleStart; } // TL
        else if (vertexInQuad == 4) { r = rStart; a = angleEnd; }   // BR
        else if (vertexInQuad == 5) { r = rEnd;   a = angleEnd; }   // TR

        // convert polar to cartesian
        vec2 pos = vec2(cos(a), sin(a)) * r;

        // aspect correction using multiplication
        gl_Position = vec4(pos * uAspectScale, 0.0, 1.0);

        // --- color ---
        // sample gradient based on logical position
        float gradientPos = (float(segmentIndex) + 0.5) / float(totalSegments);
        vec4 color = texture(colorGradient, vec2(gradientPos, 0.5));

        // handle partial opacity for the last active segment
        float alpha = 1.0;
        if (float(segmentIndex) >= floor(activeSegments)) {
            float fraction = fract(activeSegments);
            alpha = fraction;
            if (fraction < 0.01) alpha = 0.0;
        }

        vColor = vec4(color.rgb, color.a * alpha);
    }
`;

const geometryFragShader = `#version 300 es
    precision highp float;

    in vec4 vColor;
    out vec4 fragColor;

    void main() {
        fragColor = vColor;
    }
`;
