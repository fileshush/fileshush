// Hand-built image fixtures shared by the tests.

/* ---------- tiny fixtures built by hand ---------- */

export const u16 = (n) => [(n >> 8) & 255, n & 255];
export const u32 = (n) => [(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];
export const asc = (s) => [...s].map((c) => c.charCodeAt(0));

/** A big-endian EXIF block with Make, Model, Software, orientation, date and GPS. */
export function fullExifTiff({ orientation = 1 } = {}) {
  const make = [...asc("TestCam"), 0];
  const model = [...asc("Model X"), 0];
  const software = [...asc("EditorPro 9"), 0];
  const date = [...asc("2026:05:12 09:41:07"), 0];
  const latRef = [...asc("N"), 0, 0, 0];
  const lonRef = [...asc("E"), 0, 0, 0];

  // Layout: header(8) | IFD0 | Exif IFD | GPS IFD | data
  const ifd0Count = 5; // Make, Model, Orientation, Software, ExifPtr(+GPSPtr = 6)
  const ifd0Entries = 6;
  const ifd0Size = 2 + ifd0Entries * 12 + 4;
  const exifOff = 8 + ifd0Size;
  const exifSize = 2 + 1 * 12 + 4;
  const gpsOff = exifOff + exifSize;
  const gpsEntries = 4;
  const gpsSize = 2 + gpsEntries * 12 + 4;
  let data = gpsOff + gpsSize;

  const makeOff = data; data += make.length;
  const modelOff = data; data += model.length;
  const softOff = data; data += software.length;
  const dateOff = data; data += date.length;
  const latOff = data; data += 24; // 3 rationals
  const lonOff = data; data += 24;

  const entry = (tag, type, count, value) => [...u16(tag), ...u16(type), ...u32(count), ...value];
  const ifd0 = [
    ...u16(ifd0Entries),
    ...entry(0x010f, 2, make.length, u32(makeOff)),
    ...entry(0x0110, 2, model.length, u32(modelOff)),
    ...entry(0x0112, 3, 1, [...u16(orientation), 0, 0]),
    ...entry(0x0131, 2, software.length, u32(softOff)),
    ...entry(0x8769, 4, 1, u32(exifOff)),
    ...entry(0x8825, 4, 1, u32(gpsOff)),
    ...u32(0),
  ];
  const exifIfd = [...u16(1), ...entry(0x9003, 2, date.length, u32(dateOff)), ...u32(0)];
  const gpsIfd = [
    ...u16(gpsEntries),
    ...entry(0x0001, 2, 2, latRef),
    ...entry(0x0002, 5, 3, u32(latOff)),
    ...entry(0x0003, 2, 2, lonRef),
    ...entry(0x0004, 5, 3, u32(lonOff)),
    ...u32(0),
  ];
  const rat = (n, d = 1) => [...u32(n), ...u32(d)];
  // 6 deg 55 min 37.56 sec N  = 6.92710 ; 79 deg 51 min 40.32 sec E = 79.86120
  const lat = [...rat(6), ...rat(55), ...rat(3756, 100)];
  const lon = [...rat(79), ...rat(51), ...rat(4032, 100)];

  return Uint8Array.from([
    ...asc("MM"), ...u16(0x2a), ...u32(8),
    ...ifd0, ...exifIfd, ...gpsIfd,
    ...make, ...model, ...software, ...date, ...lat, ...lon,
  ]);
}

export const segment = (marker, payload) => [0xff, marker, ...u16(payload.length + 2), ...payload];

/** A real, decodable 1x1 baseline JPEG (no metadata). */
export const BASE_JPEG = Uint8Array.from(
  Buffer.from(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
    "base64",
  ),
);

export function jpegWith(extraSegments) {
  // SOI + JFIF(APP0 already inside BASE_JPEG) -> insert extras right after SOI
  return Uint8Array.from([0xff, 0xd8, ...extraSegments.flat(), ...BASE_JPEG.subarray(2)]);
}

export function privateJpeg({ orientation = 1 } = {}) {
  return jpegWith([
    segment(0xe1, [...asc("Exif\0\0"), ...fullExifTiff({ orientation })]),
    segment(0xe1, [...asc("http://ns.adobe.com/xap/1.0/\0"), ...asc("<x:xmpmeta>secret</x:xmpmeta>")]),
    segment(0xed, [...asc("Photoshop 3.0\0"), ...asc("8BIM")]),
    segment(0xfe, asc("shot at my house")),
  ]);
}

