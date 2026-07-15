import { TestBed } from '@angular/core/testing'
import { Router } from '@angular/router'
import { MessageService } from 'primeng/api'
import { AuthService } from '~/auth/services/auth.service'
import {
  getSignInErrorMessage,
  SignInFormComponent
} from './sign-in-form.component'

describe('getSignInErrorMessage', () => {
  it('uses a generic message when session activation has no mapped error code', () => {
    expect(getSignInErrorMessage()).toEqual({
      summary: 'No se pudo iniciar sesión',
      message: 'Ocurrió un error inesperado. Intenta nuevamente.'
    })
  })
})

describe('SignInFormComponent', () => {
  it('navigates to the portal and clears loading after a successful sign-in', async () => {
    const signIn = jest.fn().mockResolvedValue(undefined)
    const navigateByUrl = jest.fn().mockResolvedValue(true)

    await TestBed.configureTestingModule({
      imports: [SignInFormComponent],
      providers: [
        { provide: AuthService, useValue: { signIn } },
        { provide: Router, useValue: { navigateByUrl } },
        { provide: MessageService, useValue: { add: jest.fn() } }
      ]
    })
      .overrideComponent(SignInFormComponent, { set: { template: '' } })
      .compileComponents()

    const fixture = TestBed.createComponent(SignInFormComponent)
    const component = fixture.componentInstance
    component.signInForm.setValue({
      email: 'teacher@example.com',
      password: 'Password123!'
    })

    await component.signIn()

    expect(navigateByUrl).toHaveBeenCalledWith('/p/general')
    expect(component.signInLoading()).toBe(false)
  })

  it('clears loading and shows an error when sign-in is rejected', async () => {
    const signIn = jest.fn().mockRejectedValue(new Error('Invalid credentials'))
    const navigateByUrl = jest.fn()
    const add = jest.fn()

    await TestBed.configureTestingModule({
      imports: [SignInFormComponent],
      providers: [
        { provide: AuthService, useValue: { signIn } },
        { provide: Router, useValue: { navigateByUrl } },
        { provide: MessageService, useValue: { add } }
      ]
    })
      .overrideComponent(SignInFormComponent, {
        set: {
          template: '',
          providers: [{ provide: MessageService, useValue: { add } }]
        }
      })
      .compileComponents()

    const fixture = TestBed.createComponent(SignInFormComponent)
    const component = fixture.componentInstance
    component.signInForm.setValue({
      email: 'teacher@example.com',
      password: 'Password123!'
    })

    await component.signIn()

    expect(component.signInLoading()).toBe(false)
    expect(add).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'No se pudo iniciar sesión',
      detail: 'Ocurrió un error inesperado. Intenta nuevamente.'
    })
  })

  it('clears loading and shows an error when portal navigation is rejected', async () => {
    const signIn = jest.fn().mockResolvedValue(undefined)
    const navigateByUrl = jest.fn().mockRejectedValue(new Error('Navigation failed'))
    const add = jest.fn()

    await TestBed.configureTestingModule({
      imports: [SignInFormComponent],
      providers: [
        { provide: AuthService, useValue: { signIn } },
        { provide: Router, useValue: { navigateByUrl } },
        { provide: MessageService, useValue: { add } }
      ]
    })
      .overrideComponent(SignInFormComponent, {
        set: {
          template: '',
          providers: [{ provide: MessageService, useValue: { add } }]
        }
      })
      .compileComponents()

    const fixture = TestBed.createComponent(SignInFormComponent)
    const component = fixture.componentInstance
    component.signInForm.setValue({
      email: 'teacher@example.com',
      password: 'Password123!'
    })

    await component.signIn()

    expect(signIn).toHaveBeenCalledWith('teacher@example.com', 'Password123!')
    expect(navigateByUrl).toHaveBeenCalledWith('/p/general')
    expect(component.signInLoading()).toBe(false)
    expect(add).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'No se pudo iniciar sesión',
      detail: 'Ocurrió un error inesperado. Intenta nuevamente.'
    })
  })
})
