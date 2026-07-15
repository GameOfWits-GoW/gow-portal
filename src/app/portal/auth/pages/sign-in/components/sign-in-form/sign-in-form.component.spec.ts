import { getSignInErrorMessage } from './sign-in-form.component'

describe('getSignInErrorMessage', () => {
  it('uses a generic message when session activation has no mapped error code', () => {
    expect(getSignInErrorMessage()).toEqual({
      summary: 'No se pudo iniciar sesión',
      message: 'Ocurrió un error inesperado. Intenta nuevamente.'
    })
  })
})
