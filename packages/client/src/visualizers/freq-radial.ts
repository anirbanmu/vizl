import type { AudioAnalysisData, AudioAnalysisMetadata } from '../audio/types';
import { BaseAudioVisualiserGL } from './base-gl';
import { type Vector2d, hexToRGB } from './base';

const FREQUENCY_BAR_DIVS = 28;
const MIN_RADIUS_SCALE = 0.15;
const MAX_RADIUS_SCALE = 0.5; // controls how much the base radius expands with intensity
const BAR_STACK_HEIGHT_SCALE = 0.35; // height of the bar stack relative to screen size
const STACK_GAP_PERCENTAGE = 0.2; // 20% of each segment is gap (radial)
const ANGULAR_GAP_PERCENTAGE = 0.2; // 20% of the angular slice is gap

export class FrequencyRadialVisualiser extends BaseAudioVisualiserGL {
  private dataTexture!: WebGLTexture;
  private gradientTexture!: WebGLTexture;
  private program!: WebGLProgram;
  private vertCount = 0;
  private barDivs = FREQUENCY_BAR_DIVS;
  private lineWidths!: Vector2d;

  constructor(canvas: HTMLCanvasElement, metadata: AudioAnalysisMetadata) {
    super(canvas, {
      ...metadata,
      frequencyBinCount: 4 * Math.trunc((0.7 * metadata.frequencyBinCount) / 4), // shader expects this to divisible by 4
    });

    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);
    this.gl.enable(this.gl.BLEND);

    this.prepShaders();
    this.resize();
  }

  protected renderFrame(data: AudioAnalysisData): void {
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

    const scalingDim = this.minDim() / 2;
    const freqIntensityFactor = computeIntensityFactor(data.frequencyData);

    // calculate base radius based on audio intensity ("breathing" effect)
    const baseRadius = scalingDim * (MIN_RADIUS_SCALE + freqIntensityFactor * (MAX_RADIUS_SCALE - MIN_RADIUS_SCALE));

    const baseRadiusLoc = this.getUniformLocation(this.program, 'baseRadius');
    this.gl.uniform1f(baseRadiusLoc, baseRadius);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, this.vertCount);
  }

  protected onResize(): void {
    const dimensionsLoc = this.getUniformLocation(this.program, 'dimensions');
    this.gl.uniform2fv(dimensionsLoc, new Float32Array([this.gl.drawingBufferWidth, this.gl.drawingBufferHeight]));

    const scalingDim = this.minDim() / 2;

    // calculate geometric constants
    // we model the "bar stack" as a series of segments, where each segment contains a bar and a gap.
    // the segments grow quadratically in size.
    const totalStackHeight = scalingDim * BAR_STACK_HEIGHT_SCALE;

    // heuristic: start with a small segment height (approx half of the average)
    const startSegmentHeight = (totalStackHeight / this.barDivs) * 0.5;

    // solve for the quadratic curve C(i) = A*i + B*i^2
    // such that C(0) = 0, C(1) = startHeight, C(N) = totalHeight
    const { A, B } = solveGrowth(totalStackHeight, startSegmentHeight, this.barDivs);

    const uCumulativePolyLoc = this.getUniformLocation(this.program, 'uCumulativePoly');
    this.gl.uniform2f(uCumulativePolyLoc, A, B);

    const uStackGapPercentageLoc = this.getUniformLocation(this.program, 'uStackGapPercentage');
    this.gl.uniform1f(uStackGapPercentageLoc, STACK_GAP_PERCENTAGE);

    const uMaxRadiusLoc = this.getUniformLocation(this.program, 'uMaxRadius');
    this.gl.uniform1f(uMaxRadiusLoc, totalStackHeight);
  }

  private prepShaders(): void {
    const gradientStops = [
      { hex: 0x00d1b1, alpha: 0.0, stop: 0.0 },
      { hex: 0xabe300, alpha: 0.7, stop: 0.2 },
      { hex: 0xff8400, alpha: 1.0, stop: 0.65 },
      { hex: 0xff2d00, alpha: 1.0, stop: 1.0 },
    ];

    const vertexSource = this.templateShader(aspectCorrectingVertShader, {
      FREQUENCY_BARS: this.frequencyBinCount,
      FREQUENCY_BAR_DIVS: this.barDivs,
    });

    const fragmentSource = this.templateShader(freqBarsFragShader, {
      FREQUENCY_BAR_DIVS: this.barDivs,
    });

    this.program = this.createProgram(vertexSource, fragmentSource);
    this.gl.useProgram(this.program);

    const vertProperties = computeVertexAttributes(this.frequencyBinCount, ANGULAR_GAP_PERCENTAGE, this.barDivs);

    const indexLoc = this.getAttributeLocation(this.program, 'index');
    const indexBuffer = this.createBuffer(new Float32Array(vertProperties.indices), this.gl.STATIC_DRAW);
    this.setupAttribute(indexLoc, 3, indexBuffer);

    const barAnglesLoc = this.getAttributeLocation(this.program, 'barAngles');
    const barAnglesBuffer = this.createBuffer(new Float32Array(vertProperties.angles), this.gl.STATIC_DRAW);
    this.setupAttribute(barAnglesLoc, 2, barAnglesBuffer);

    this.vertCount = vertProperties.vertexCount;

    // create and bind gradient texture
    const gradientData = createGradientTexture(gradientStops, 256);
    const gradientTexture = this.gl.createTexture();
    if (!gradientTexture) {
      throw new Error('failed to create gradient texture');
    }
    this.gradientTexture = gradientTexture;

    // use texture unit 1 for the gradient
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
    this.gl.uniform1i(colorGradientLoc, 1); // Tell shader to use texture unit 1

    const magnitudesLoc = this.getUniformLocation(this.program, 'magnitudes');
    this.gl.uniform1i(magnitudesLoc, 0);

    const texture = this.gl.createTexture();
    if (!texture) {
      throw new Error('failed to create texture');
    }
    this.dataTexture = texture;
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
  }
}

function computeIntensityFactor(frequencyData: Float32Array): number {
  let rMultiplier = 0;
  // we only use the lower quarter of the frequency spectrum for the intensity calculation
  // as it contains the most energy (bass/mids)
  for (let i = 0; i < frequencyData.length / 4; i++) {
    rMultiplier += frequencyData[i];
  }
  return rMultiplier / (frequencyData.length / 4);
}

/**
 * solves for the quadratic coefficients A and B for a cumulative growth function:
 * C(i) = A*i + B*i^2
 *
 * constraints:
 * 1. C(0) = 0 (Implicit)
 * 2. C(1) = startSize (The size of the first item)
 * 3. C(count) = totalSize (The cumulative size of all items)
 */
function solveGrowth(totalSize: number, startSize: number, count: number): { A: number; B: number } {
  const B = (totalSize - count * startSize) / (count * (count - 1));
  const A = startSize - B;
  return { A, B };
}

function computeVertexAttributes(
  divisions: number,
  gapPercent: number,
  barCount: number,
): { indices: Array<number>; angles: Array<number>; vertexCount: number } {
  const angularIncrement = (-2 * Math.PI) / divisions;
  const angleOffset = (angularIncrement * gapPercent) / 2;

  const indices = [],
    angles = [];
  for (let i = 0; i < divisions; i++) {
    for (let j = 0; j < barCount; j++) {
      // 6 vertices per quad (2 triangles)
      for (let k = 0; k < 6; k++) {
        indices.push(i, j, k);
        angles.push(angularIncrement * i + angleOffset, angularIncrement * (i + 1) - angleOffset);
      }
    }
  }

  return { indices, angles, vertexCount: angles.length / 2 };
}

const aspectCorrectingVertShader = `#version 300 es
    precision highp float;

    in vec3 index; // x: poly-index, y: bar-index, z: vertex-index
    in vec2 barAngles; // angles of this bar. (start, end)

    uniform vec2 dimensions;
    uniform vec2 uCumulativePoly; // x: A, y: B for C(i) = A*i + B*i^2
    uniform float uStackGapPercentage;
    uniform float baseRadius;
    uniform sampler2D magnitudes;

    out float normalizedMagnitude;
    out vec2 angles;
    out vec2 radii;
    out float divIndex;

    float getMagnitude(int index) {
        return texelFetch(magnitudes, ivec2(index, 0), 0).r;
    }

    vec4 generateTriangleVertex(int idx, vec2 angleSpan, vec2 radiiSpan, vec2 aspect) {
        vec2 sortedAngles = vec2(max(angleSpan.x, angleSpan.y), min(angleSpan.x, angleSpan.y));
        
        bool useEndAngle = (idx >= 1 && idx <= 3);
        bool useOuterRadius = (idx >= 2 && idx <= 4);

        float angle = useEndAngle ? sortedAngles.y : sortedAngles.x;
        float radius = useOuterRadius ? radiiSpan.y : radiiSpan.x;

        return vec4(cos(angle) * radius * aspect.x, sin(angle) * radius * aspect.y, 0.0, 1.0);
    }

    float getCumulativeHeight(float i) {
        return uCumulativePoly.x * i + uCumulativePoly.y * i * i;
    }

    void main() {
        angles = barAngles;
        normalizedMagnitude = getMagnitude(int(index.x));

        float i = index.y;

        // calculate the start of this segment and the next segment
        float startRadius = baseRadius + getCumulativeHeight(i);
        float nextRadius = baseRadius + getCumulativeHeight(i + 1.0);

        // the segment height is the difference
        float segmentHeight = nextRadius - startRadius;

        // the bar occupies the first (1.0 - gap) portion of the segment
        float barHeight = segmentHeight * (1.0 - uStackGapPercentage);

        radii = vec2(startRadius, startRadius + barHeight);

        divIndex = index.y;

        float minDim = min(dimensions.x, dimensions.y);
        gl_Position = generateTriangleVertex(int(index.z), angles, radii / (minDim / 2.0), vec2(minDim / dimensions.x, minDim / dimensions.y));
    }
`;

const freqBarsFragShader = `#version 300 es
    precision highp float;

    uniform vec2 dimensions;
    uniform float baseRadius;
    uniform float uMaxRadius;

    uniform sampler2D colorGradient;

    in float normalizedMagnitude;
    in vec2 angles;
    in vec2 radii;
    in float divIndex;

    out vec4 fragColor;

    vec4 getColor(float radius, vec2 bounds) {
        float rangeRelativeRadius = radius - bounds.x;
        float rangeRadius = bounds.y - bounds.x;
        float normalized = clamp(rangeRelativeRadius / rangeRadius, 0.0, 1.0);

        // sample the gradient texture at the normalized position.
        // we use 0.5 for the y-coordinate to sample the center of the 1D texture.
        return texture(colorGradient, vec2(normalized, 0.5));
    }

    const float pi = 3.141592653589793;

    float getAngle(vec2 position) {
        float angle = atan(position.y, position.x);
        if (angle > 0.0) {
            angle -= 2.0 * pi;
        }
        return angle;
    }

    vec4 applyRadialEdgeTransparency(vec4 color, float radius, vec2 edgeRadii) {
        const float allowedDelta = 0.15;
        float delta = min(radius - edgeRadii.x, edgeRadii.y - radius) / (edgeRadii.y - edgeRadii.x);
        if (delta < allowedDelta) {
            return vec4(color.rgb, color.a * (delta / allowedDelta));
        }
        return color;
    }

    vec4 applyBarEdgeTransparency(vec4 color, vec2 position, vec2 angleBounds) {
        float angle = getAngle(position);

        const float allowedDelta = 0.10;
        float delta = min(abs(angleBounds.x - angle), abs(angleBounds.y - angle)) / abs(angleBounds.y - angleBounds.x);
        if (delta < allowedDelta) {
            return vec4(color.rgb, color.a * (delta / allowedDelta));
        }
        return color;
    }

    void main() {
        vec2 center = dimensions * 0.5;
        vec2 pos = gl_FragCoord.xy - center;
        float radius = length(pos);
        float rawDivs = normalizedMagnitude * float(FREQUENCY_BAR_DIVS);
        float partialLastDiv = rawDivs - floor(rawDivs);
        int lastDivIndex = int(floor(rawDivs));

        float innerRadius = radii.x;
        float outerRadius = radii.y;
        int thisDivIndex = int(divIndex);
        outerRadius = lastDivIndex == thisDivIndex ? innerRadius + partialLastDiv * (outerRadius - innerRadius) : outerRadius;
        if (thisDivIndex > lastDivIndex || radius < innerRadius || radius > outerRadius) {
            fragColor = vec4(0.0, 0.0, 0.0, 0.0);
            return;
        }

        fragColor = getColor(radius, vec2(baseRadius, baseRadius + uMaxRadius));
        fragColor = applyRadialEdgeTransparency(fragColor, radius, vec2(innerRadius, outerRadius));
        fragColor = applyBarEdgeTransparency(fragColor, pos, angles);
    }
`;

interface GradientStop {
  hex: number;
  alpha: number;
  stop: number;
}

function createGradientTexture(stops: GradientStop[], width: number): Uint8Array {
  const data = new Uint8Array(width * 4);

  // sort stops by position just in case
  const sortedStops = [...stops].sort((a, b) => a.stop - b.stop);

  // ensure we have stops at 0.0 and 1.0 if not present, or handle logic to clamp
  // the logic below assumes we interpolate between available stops.

  let currentStopIndex = 0;

  for (let i = 0; i < width; i++) {
    const t = i / (width - 1);

    // find the two stops we are between
    while (currentStopIndex < sortedStops.length - 1 && t > sortedStops[currentStopIndex + 1].stop) {
      currentStopIndex++;
    }

    const startStop = sortedStops[currentStopIndex];
    const endStop = sortedStops[currentStopIndex + 1];

    let r, g, b, a;

    if (!endStop) {
      // we are past the last stop
      const rgb = hexToRGB(startStop.hex);
      r = rgb[0] * 255;
      g = rgb[1] * 255;
      b = rgb[2] * 255;
      a = startStop.alpha * 255;
    } else if (t < startStop.stop) {
      // we are before the first stop (shouldn't happen if 0.0 is first, but good for safety)
      const rgb = hexToRGB(startStop.hex);
      r = rgb[0] * 255;
      g = rgb[1] * 255;
      b = rgb[2] * 255;
      a = startStop.alpha * 255;
    } else {
      // interpolate
      const localT = (t - startStop.stop) / (endStop.stop - startStop.stop);
      const startRGB = hexToRGB(startStop.hex);
      const endRGB = hexToRGB(endStop.hex);

      r = (startRGB[0] + (endRGB[0] - startRGB[0]) * localT) * 255;
      g = (startRGB[1] + (endRGB[1] - startRGB[1]) * localT) * 255;
      b = (startRGB[2] + (endRGB[2] - startRGB[2]) * localT) * 255;
      a = (startStop.alpha + (endStop.alpha - startStop.alpha) * localT) * 255;
    }

    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  }

  return data;
}
