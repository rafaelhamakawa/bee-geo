declare module "open-location-code" {
  export class OpenLocationCode {
    isValid(code: string): boolean;
    isShort(code: string): boolean;
    isFull(code: string): boolean;
    encode(latitude: number, longitude: number, codeLength?: number): string;
    decode(code: string): {
      latitudeCenter: number;
      longitudeCenter: number;
      latitudeLo: number;
      longitudeLo: number;
      latitudeHi: number;
      longitudeHi: number;
      codeLength: number;
    };
    recoverNearest(shortCode: string, referenceLatitude: number, referenceLongitude: number): string;
    shorten(code: string, latitude: number, longitude: number): string;
  }
}
