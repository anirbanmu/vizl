import type { AudioAnalysisData, AudioAnalysisMetadata } from '../audio/types';
import { BaseAudioVisualiserGL } from './base-gl';

export class FrequencyBackgroundVisualiser extends BaseAudioVisualiserGL {
  private dataTexture: WebGLTexture;

  constructor(canvas: HTMLCanvasElement, metadata: AudioAnalysisMetadata) {
    const adjustedMetadata = {
      ...metadata,
      frequencyBinCount: Math.trunc(metadata.frequencyBinCount * 0.725),
    };

    super(canvas, adjustedMetadata);

    this.gl.blendFuncSeparate(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA, this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
    this.gl.enable(this.gl.BLEND);

    this.dataTexture = this.prepShaders();
    this.resize();
  }

  protected renderFrame(data: AudioAnalysisData): void {
    // texture 0 is already bound to dataTexture from init
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

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  private prepShaders(): WebGLTexture {
    const vertexSource = quadVertShader;
    const fragmentSource = this.templateShader(freqBackgroundFragShader, {
      FREQUENCY_BARS: this.frequencyBinCount,
    });

    const program = this.createProgram(vertexSource, fragmentSource);
    this.gl.useProgram(program);

    const indexLocation = this.getAttributeLocation(program, 'index');
    const indexBuffer = this.createBuffer(new Float32Array([0, 1, 2, 3]), this.gl.STATIC_DRAW);
    this.setupAttribute(indexLocation, 1, indexBuffer);

    const dataTexture = this.gl.createTexture();
    if (!dataTexture) {
      throw new Error('failed to create texture');
    }

    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, dataTexture);
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

    const magnitudesLoc = this.getUniformLocation(program, 'magnitudes');
    this.gl.uniform1i(magnitudesLoc, 0);

    return dataTexture;
  }
}

const quadVertShader = `#version 300 es
precision highp float;

in float index;
out vec2 vNormalizedCoord;

const vec4 positions[4] = vec4[4](
    vec4(-1.0, 1.0, 0.0, 1.0),
    vec4(1.0, 1.0, 0.0, 1.0),
    vec4(-1.0, -1.0, 0.0, 1.0),
    vec4(1.0, -1.0, 0.0, 1.0)
);

const vec2 texCoords[4] = vec2[4](
    vec2(0.0, 1.0),
    vec2(1.0, 1.0),
    vec2(0.0, 0.0),
    vec2(1.0, 0.0)
);

void main() {
    int i = int(index);
    gl_Position = positions[i];
    vNormalizedCoord = texCoords[i];
}
`;

const freqBackgroundFragShader = `#version 300 es
precision highp float;

in vec2 vNormalizedCoord;
uniform sampler2D magnitudes;

out vec4 fragColor;

float getMagnitude(int index) {
    return texelFetch(magnitudes, ivec2(index, 0), 0).r;
}

float cubicInterpolate(float p0, float p1, float p2, float p3, float t) {
    return p1 + 0.5 * t * (p2 - p0 + t * (2.0*p0 - 5.0*p1 + 4.0*p2 - p3 + t * (3.0*(p1 - p2) + p3 - p0)));
}

void main() {
    float freqIndexFloat = vNormalizedCoord.y * float(FREQUENCY_BARS);
    int freqIndex = int(freqIndexFloat);
    float binPosition = fract(freqIndexFloat);

    int p0Index = max(0, freqIndex - 1);
    int p1Index = freqIndex;
    int p2Index = min(FREQUENCY_BARS - 1, freqIndex + 1);
    int p3Index = min(FREQUENCY_BARS - 1, freqIndex + 2);

    float p0 = getMagnitude(p0Index);
    float p1 = getMagnitude(p1Index);
    float p2 = getMagnitude(p2Index);
    float p3 = getMagnitude(p3Index);

    float colorFactor = cubicInterpolate(p0, p1, p2, p3, binPosition);

    float horizontalFade = 2.0 * abs(0.5 - vNormalizedCoord.x);
    horizontalFade = mix(0.01, 1.0, pow(horizontalFade, 5.0));

    fragColor = vec4(
        colorFactor * colorFactor,
        0.75 * pow(colorFactor, 3.0),
        0.5 * pow(colorFactor, 4.0),
        horizontalFade
    );
}
`;
