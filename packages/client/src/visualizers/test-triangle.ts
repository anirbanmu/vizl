import { BaseAudioVisualiserGL } from './base-gl';
import type { AudioAnalysisData } from '../audio/types';

export class TestTriangleVisualiser extends BaseAudioVisualiserGL {
  private program!: WebGLProgram;
  private buffer!: WebGLBuffer;
  private positionLocation!: number;
  private colorLocation!: WebGLUniformLocation;
  private scaleLocation!: WebGLUniformLocation;

  initialize(): void {
    const vertexShader = `#version 300 es
precision highp float;
in vec2 position;
uniform float scale;

void main() {
  gl_Position = vec4(position * scale, 0.0, 1.0);
}`;

    const fragmentShader = `#version 300 es
precision highp float;
uniform vec3 color;
out vec4 fragColor;

void main() {
  fragColor = vec4(color, 1.0);
}`;

    this.program = this.createProgram(vertexShader, fragmentShader);
    this.positionLocation = this.getAttributeLocation(this.program, 'position');
    this.colorLocation = this.getUniformLocation(this.program, 'color');
    this.scaleLocation = this.getUniformLocation(this.program, 'scale');

    const vertices = new Float32Array([0.0, 0.5, -0.5, -0.5, 0.5, -0.5]);

    this.buffer = this.createBuffer(vertices, this.gl.STATIC_DRAW);
  }

  render(data: AudioAnalysisData): void {
    this.gl.clearColor(0, 0, 0, 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    const bassEnergy = this.averageRange(data.frequencyData, 0, 10);
    const midEnergy = this.averageRange(data.frequencyData, 10, 40);
    const highEnergy = this.averageRange(data.frequencyData, 40, 80);

    const scale = 0.5 + bassEnergy * 0.5;
    const r = bassEnergy;
    const g = midEnergy;
    const b = highEnergy;

    this.gl.useProgram(this.program);
    this.setupAttribute(this.positionLocation, 2, this.buffer);
    this.gl.uniform3f(this.colorLocation, r, g, b);
    this.gl.uniform1f(this.scaleLocation, scale);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
  }

  private averageRange(data: Float32Array, start: number, end: number): number {
    const actualEnd = Math.min(end, data.length);
    let sum = 0;
    for (let i = start; i < actualEnd; i++) {
      sum += data[i];
    }
    return sum / (actualEnd - start);
  }
}
