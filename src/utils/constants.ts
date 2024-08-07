interface Constants {
  confederacyURL: string
  peerservURL: string
}

let constants: Constants

if (
  window.location.host.startsWith("localhost")
  || window.location.host.startsWith("staging")
  || process.env.NODE_ENV === "development"
) {
  // local
  constants = {
    confederacyURL: "https://staging-confederacy.babbage.systems",
    peerservURL: 'https://staging-peerserv.babbage.systems'
  }
} else {
  // production
  constants = {
    confederacyURL: 'https://confederacy.babbage.systems',
    peerservURL: 'https://peerserv.babbage.systems'
  }
}

export default constants
