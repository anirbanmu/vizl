import type { AudioAnalysisData, AudioAnalysisMetadata } from '../audio/types';
import { BaseAudioVisualiser, type Vector2d } from './base';

class WebGLInitializationException extends Error {
  constructor(error: string) {
    super(error);
    Object.setPrototypeOf(this, WebGLInitializationException.prototype);
  }
}

export abstract class BaseAudioVisualiserGL extends BaseAudioVisualiser {
  protected gl: WebGL2RenderingContext;

  constructor(canvas: HTMLCanvasElement, metadata: AudioAnalysisMetadata) {
    super(canvas, metadata);

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: true,
    });
    if (!gl) {
      throw new WebGLInitializationException('webgl 2 not supported');
    }

    this.gl = gl;
    this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
  }

  protected minDim(): number {
    return Math.min(this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
  }

  protected center(): Vector2d {
    return {
      x: this.gl.drawingBufferWidth / 2,
      y: this.gl.drawingBufferHeight / 2,
    };
  }

  render(data: AudioAnalysisData): void {
    this.renderFrame(data);
  }

  protected abstract renderFrame(data: AudioAnalysisData): void;

  protected onResize(): void {
    // hook for subclasses to update uniforms on resize
  }

  resize(width: number = 0, height: number = 0): void {
    super.resize(width, height);
    this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
    this.onResize();
  }

  protected compileShader(shaderType: number, source: string): WebGLShader {
    const shader = this.gl.createShader(shaderType);
    if (!shader) {
      throw new WebGLInitializationException('failed to create shader');
    }

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const log = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new WebGLInitializationException(`shader compilation failed:\n${log}`);
    }

    return shader;
  }

  protected createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentSource);

    const program = this.gl.createProgram();
    if (!program) {
      throw new WebGLInitializationException('failed to create program');
    }

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const log = this.gl.getProgramInfoLog(program);
      this.gl.deleteProgram(program);
      throw new WebGLInitializationException(`program linking failed:\n${log}`);
    }

    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);

    return program;
  }

  protected getAttributeLocation(program: WebGLProgram, name: string): number {
    const location = this.gl.getAttribLocation(program, name);
    if (location === -1) {
      throw new WebGLInitializationException(`attribute '${name}' not found in program`);
    }
    return location;
  }

  protected getUniformLocation(program: WebGLProgram, name: string): WebGLUniformLocation {
    const location = this.gl.getUniformLocation(program, name);
    if (!location) {
      throw new WebGLInitializationException(`uniform '${name}' not found in program`);
    }
    return location;
  }

  protected templateShader(source: string, values: Record<string, string | number>): string {
    return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(key, value.toString()), source);
  }

  protected createBuffer(data: Float32Array, usage: number): WebGLBuffer {
    const buffer = this.gl.createBuffer();
    if (!buffer) {
      throw new WebGLInitializationException('failed to create buffer');
    }

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, data, usage);

    return buffer;
  }

  protected setupAttribute(location: number, size: number, buffer: WebGLBuffer): void {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.enableVertexAttribArray(location);
    this.gl.vertexAttribPointer(location, size, this.gl.FLOAT, false, 0, 0);
  }
}
