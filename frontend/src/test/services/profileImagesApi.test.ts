import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  uploadGroupImage,
  deleteGroupImage,
  updateMyProfile,
  uploadMyAvatar,
  deleteMyAvatar,
  setAuthToken,
} from '../../services/api';
import { validateImageFile } from '../../utils/image';

describe('API de imágenes y perfil', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    setAuthToken('jwt-123');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    setAuthToken(null);
  });

  const ok = (body: unknown) =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

  it('sube la imagen de liga como multipart PUT con el token y sin Content-Type manual', async () => {
    fetchMock.mockReturnValue(ok({ imageUrl: '/api/groups/7/image?v=1' }));
    const res = await uploadGroupImage(7, new Blob(['a'], { type: 'image/png' }));

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/groups/7/image');
    expect(opts.method).toBe('PUT');
    expect(opts.body).toBeInstanceOf(FormData);
    expect(opts.body.get('file')).toBeInstanceOf(Blob);
    expect(opts.headers.Authorization).toBe('Bearer jwt-123');
    expect(opts.headers['Content-Type']).toBeUndefined();
    expect(res.imageUrl).toContain('/api/groups/7/image');
  });

  it('propaga el mensaje de error del servidor (403/400)', async () => {
    fetchMock.mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 403,
        json: () =>
          Promise.resolve({ error: 'Solo el administrador de la liga puede cambiar su imagen.' }),
      }),
    );
    await expect(uploadGroupImage(7, new Blob(['a']))).rejects.toThrow(/administrador/);
  });

  it('borra la imagen de liga con DELETE', async () => {
    fetchMock.mockReturnValue(ok({ status: 'success', imageUrl: null }));
    await deleteGroupImage(7);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/groups/7/image');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });

  it('actualiza solo el nombre público enviando JSON', async () => {
    fetchMock.mockReturnValue(ok({ participantName: 'Nuevo' }));
    await updateMyProfile('Nuevo');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/users/me/profile');
    expect(opts.method).toBe('PUT');
    expect(JSON.parse(opts.body)).toEqual({ participantName: 'Nuevo' });
  });

  it('sube y elimina la foto de perfil del usuario autenticado', async () => {
    fetchMock.mockReturnValue(ok({ avatarUrl: '/api/users/1/avatar?v=2' }));
    await uploadMyAvatar(new Blob(['a'], { type: 'image/jpeg' }));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/users/me/avatar');
    await deleteMyAvatar();
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
  });

  it('validateImageFile rechaza SVG, GIF y texto', () => {
    expect(validateImageFile(new File(['x'], 'a.svg', { type: 'image/svg+xml' }))).toBeTruthy();
    expect(validateImageFile(new File(['x'], 'a.gif', { type: 'image/gif' }))).toBeTruthy();
    expect(validateImageFile(new File(['x'], 'a.txt', { type: 'text/plain' }))).toBeTruthy();
    expect(validateImageFile(new File(['x'], 'a.png', { type: 'image/png' }))).toBeNull();
    expect(validateImageFile(new File(['x'], 'a.jpg', { type: 'image/jpeg' }))).toBeNull();
    expect(validateImageFile(new File(['x'], 'a.webp', { type: 'image/webp' }))).toBeNull();
    expect(validateImageFile(new File(['x'], 'a.heic', { type: 'image/heic' }))).toMatch(
      /HEIC\/HEIF/,
    );
  });
});
