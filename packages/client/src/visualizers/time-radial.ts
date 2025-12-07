import type { AudioAnalysisData, AudioAnalysisMetadata } from '../audio/types';
import { BaseAudioVisualiserGL } from './base-gl';

const BASE_RADIUS = 0.2;
const MAGNITUDE_SCALE_FACTOR = 0.5;
const WAVEFORM_COLOR = new Float32Array([0.905, 0.298, 0.235, 0.5]);

export class TimeRadialVisualiser extends BaseAudioVisualiserGL {
  private dataTexture!: WebGLTexture;
  private program!: WebGLProgram;
  private aspectScaleLoc!: WebGLUniformLocation;
  private vertexCount!: number;

  constructor(canvas: HTMLCanvasElement, metadata: AudioAnalysisMetadata) {
    super(canvas, metadata);

    this.gl.blendFuncSeparate(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA, this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
    this.gl.enable(this.gl.BLEND);

    this.dataTexture = this.prepShaders();
    this.resize();
  }

  protected renderFrame(data: AudioAnalysisData): void {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    this.gl.texSubImage2D(this.gl.TEXTURE_2D, 0, 0, 0, this.timeFftSize, 1, this.gl.RED, this.gl.FLOAT, data.timeData);

    this.gl.drawArraysInstanced(this.gl.LINE_STRIP, 0, this.vertexCount, 2);
  }

  protected onResize(): void {
    const minDim = this.minDim();
    const width = this.gl.drawingBufferWidth;
    const height = this.gl.drawingBufferHeight;
    this.gl.uniform2f(this.aspectScaleLoc, minDim / width, minDim / height);
  }

  private prepShaders(): WebGLTexture {
    const vertexShaderSource = `#version 300 es

uniform sampler2D magnitudes;
uniform float baseRadius;
uniform float magnitudeScale;
uniform float angularIncrement;
uniform vec2 aspectScale;

void main() {
  float direction = gl_InstanceID == 0 ? 1.0 : -1.0;
  float magnitude = texelFetch(magnitudes, ivec2(gl_VertexID, 0), 0).r;
  float angle = direction * angularIncrement * float(gl_VertexID);
  float finalRadius = baseRadius + magnitudeScale * magnitude;

  float x = finalRadius * cos(angle);
  float y = finalRadius * sin(angle);

  gl_Position = vec4(x * aspectScale.x, y * aspectScale.y, 0.0, 1.0);
}`;

    const fragmentShaderSource = `#version 300 es
precision highp float;

uniform vec4 color;
out vec4 fragColor;

void main() {
  fragColor = color;
}`;

    this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
    this.gl.useProgram(this.program);

    this.vertexCount = this.timeFftSize;

    const texture = this.gl.createTexture();
    if (!texture) {
      throw new Error('failed to create texture');
    }
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.R16F, this.timeFftSize, 1, 0, this.gl.RED, this.gl.FLOAT, null);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

    const baseRadius = BASE_RADIUS;
    const magnitudeScale = BASE_RADIUS * MAGNITUDE_SCALE_FACTOR;
    const angularIncrement = (2 * Math.PI) / this.timeFftSize;

    const baseRadiusLoc = this.getUniformLocation(this.program, 'baseRadius');
    const magnitudeScaleLoc = this.getUniformLocation(this.program, 'magnitudeScale');
    const angularIncrementLoc = this.getUniformLocation(this.program, 'angularIncrement');
    this.aspectScaleLoc = this.getUniformLocation(this.program, 'aspectScale');
    const colorLoc = this.getUniformLocation(this.program, 'color');
    const magnitudesLoc = this.getUniformLocation(this.program, 'magnitudes');

    this.gl.uniform1f(baseRadiusLoc, baseRadius);
    this.gl.uniform1f(magnitudeScaleLoc, magnitudeScale);
    this.gl.uniform1f(angularIncrementLoc, angularIncrement);
    this.gl.uniform4fv(colorLoc, WAVEFORM_COLOR);
    this.gl.uniform1i(magnitudesLoc, 0);

    return texture;
  }
}
