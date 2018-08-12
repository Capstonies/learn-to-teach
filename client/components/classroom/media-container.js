import React, { Component } from 'react';

class MediaContainer extends Component {
  state = { user: '', bridge: '' }

  componentWillMount() {
    // chrome polyfill for connection between local device and remote peer
    window.RTCPeerConnection =
      window.RTCPeerConnection || window.webkitRTCPeerConnection;
    this.props.media(this);
  }

  componentDidMount() {
    this.props.getUserMedia.then(
      stream => (this.localVideo.srcObject = this.localStream = stream)
    );
    this.props.socket.on('message', this.onMessage);
    this.props.socket.on('hangup', this.onRemoteHangup);
  }

  componentWillUnmount() {
    this.props.media(null);
    if (this.localStream !== undefined) {
      this.localStream.getVideoTracks()[0].stop();
    }
    this.props.socket.emit('leave');
  }

  onRemoteHangup = () => {
    this.setState({
      user: 'host',
      bridge: 'host-hangup'
    });
  };

  onMessage = msg => {
    if (msg.type === 'offer') {
      // set remote description and answer
      this.pc.setRemoteDescription(new RTCSessionDescription(msg));
      this.pc
        .createAnswer()
        .then(this.setDescription)
        .then(this.sendDescription)
        .catch(this.handleError); // handle the failure to connect
    } else if (msg.type === 'answer') {
      // set remote description
      this.pc.setRemoteDescription(new RTCSessionDescription(msg));
    } else if (msg.type === 'candidate') {
      // add ice candidate
      this.pc.addIceCandidate(
        new RTCIceCandidate({
          sdpMLineIndex: msg.mlineindex,
          candidate: msg.candidate
        })
      );
    }
  };

  sendData = msg => this.dc.send(JSON.stringify(msg));

  // Set up the data channel message handler
  setupDataHandlers = () => {
    this.dc.onmessage = err => {
      const msg = JSON.parse(err.data);
      console.log('received message over data channel:' + msg);
    };
    this.dc.onclose = () => {
      this.remoteStream.getVideoTracks()[0].stop();
      console.log('The Data Channel is Closed');
    };
  };

  setDescription = offer => this.pc.setLocalDescription(offer);

  // send the offer to a server to be forwarded to the other peer
  sendDescription = () => this.props.socket.send(this.pc.localDescription);

  hangup = () => {
    this.setState({ user: 'guest', bridge: 'guest-hangup' });
    this.pc.close();
    this.props.socket.emit('leave');
  };

  handleError = err => console.log('error!', err);

  init = () => {
    // wait for local media to be ready
    const attachMediaIfReady = () => {
      this.dc = this.pc.createDataChannel('chat');
      this.setupDataHandlers();
      console.log('attachMediaIfReady');
      this.pc
        .createOffer()
        .then(this.setDescription)
        .then(this.sendDescription)
        .catch(this.handleError); // handle the failure to connect
    };
    // set up the peer connection
    // this is one of Google's public STUN servers
    // make sure your offer/answer role does not change. If user A does a SLD
    // with type=offer initially, it must do that during the whole session
    this.pc = new RTCPeerConnection({
      iceServers: [{ url: 'stun:stun.l.google.com:19302' }]
    });
    // when our browser gets a candidate, send it to the peer
    this.pc.onicecandidate = event => {
      console.log(event, 'onicecandidate');
      if (event.candidate) {
        this.props.socket.send({
          type: 'candidate',
          mlineindex: event.candidate.sdpMLineIndex,
          candidate: event.candidate.candidate
        });
      }
    };
    // when the other side added a media stream, show it on screen
    this.pc.onaddstream = event => {
      console.log('onaddstream', event);
      this.remoteStream = event.stream;
      this.remoteVideo.srcObject = this.remoteStream = event.stream;
      this.setState({ bridge: 'established' });
    };
    this.pc.ondatachannel = event => {
      // data channel
      this.dc = event.channel;
      this.setupDataHandlers();
      this.sendData({
        peerMediaStream: {
          video: this.localStream.getVideoTracks()[0].enabled
        }
      });
    };
    // attach local media to the peer connection
    this.localStream
      .getTracks()
      .forEach(track => this.pc.addTrack(track, this.localStream));
    // call if we were the last to connect (to increase
    // chances that everything is set up properly at both ends)
    if (this.state.user === 'host') {
      this.props.getUserMedia.then(attachMediaIfReady);
    }
  };

  render() {
    return (
      <div className={`classroom-media ${this.state.bridge}`}>
        <video
          className="video is-remote"
          ref={ref => (this.remoteVideo = ref)}
          autoPlay
        />
        <video
          className="video is-local"
          ref={ref => (this.localVideo = ref)}
          autoPlay
          muted
        />
      </div>
    );
  }
}

export default MediaContainer;