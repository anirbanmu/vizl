import type { AudioAnalysisData, AudioAnalysisMetadata } from '../audio/types';
import { BaseAudioVisualiser, type Vector2d, hexToRGB } from './base';

export interface GradientStop {
  hex: number;
  alpha: number;
  stop: number;
}



export abstract class BaseAudioVisualiserGL extends BaseAudioVisualiser {
  protected gl: WebGL2RenderingContext;

  constructor(canvas: HTMLCanvasElement, metadata: AudioAnalysisMetadata) {
    super(canvas, metadata);

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      depth: false,
      premultipliedAlpha: true,
    });
    if (!gl) {
      throw new Error('webgl 2 not supported');
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
      throw new Error('failed to create shader');
    }

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const log = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error(`shader compilation failed:\n${log}`);
    }

    return shader;
  }

  protected createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentSource);

    const program = this.gl.createProgram();
    if (!program) {
      throw new Error('failed to create program');
    }

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const log = this.gl.getProgramInfoLog(program);
      this.gl.deleteProgram(program);
      throw new Error(`program linking failed:\n${log}`);
    }

    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);

    return program;
  }

  protected getAttributeLocation(program: WebGLProgram, name: string): number {
    const location = this.gl.getAttribLocation(program, name);
    if (location === -1) {
      throw new Error(`attribute '${name}' not found in program`);
    }
    return location;
  }

  private uniformCache = new WeakMap<WebGLProgram, Map<string, WebGLUniformLocation>>();

  protected getUniformLocation(program: WebGLProgram, name: string): WebGLUniformLocation {
    let programCache = this.uniformCache.get(program);
    if (!programCache) {
      programCache = new Map();
      this.uniformCache.set(program, programCache);
    }

    if (programCache.has(name)) {
      return programCache.get(name)!;
    }

    const location = this.gl.getUniformLocation(program, name);
    if (!location) {
      throw new Error(`uniform '${name}' not found in program`);
    }

    programCache.set(name, location);
    return location;
  }

  protected templateShader(source: string, values: Record<string, string | number>): string {
    return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(key, value.toString()), source);
  }

  protected createBuffer(data: Float32Array, usage: number): WebGLBuffer {
    const buffer = this.gl.createBuffer();
    if (!buffer) {
      throw new Error('failed to create buffer');
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

  protected createGradientTexture(stops: GradientStop[], width: number): Uint8Array {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }

    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    stops.forEach(s => {
      const [r, g, b] = hexToRGB(s.hex);
      gradient.addColorStop(s.stop, `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${s.alpha})`);
    });

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, 1);

    return new Uint8Array(ctx.getImageData(0, 0, width, 1).data);
  }
}
