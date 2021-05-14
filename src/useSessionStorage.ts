import createStorage from './factory/createStorage'

export default createStorage(() => sessionStorage)
