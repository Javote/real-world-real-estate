import { configure } from '@testing-library/react'

configure({ asyncUtilTimeout: 5000 })

window.scrollTo = () => {}

HTMLCanvasElement.prototype.getContext = () => null
