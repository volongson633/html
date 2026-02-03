import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Camera, Volume2, Hand, Users, ArrowRight } from 'lucide-react';

const AccessibilityBridge = () => {
  const [step, setStep] = useState('voice-detect');
  const [person1Type, setPerson1Type] = useState('');
  const [person2Type, setPerson2Type] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [conversionMode, setConversionMode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [voiceInput, setVoiceInput] = useState('');
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [detectedText, setDetectedText] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recognitionRef = useRef(null);
  const hasWelcomedRef = useRef(false);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);

  const disabilityTypes = [
    { id: 'normal', label: 'Người bình thường', icon: Users, keywords: ['bình thường', 'không có vấn đề', 'khỏe'] },
    { id: 'blind', label: 'Người mù', icon: Camera, keywords: ['mù', 'không nhìn thấy', 'khiếm thị'] },
    { id: 'mute', label: 'Người câm', icon: Mic, keywords: ['câm', 'không nói được', 'khiếm khẩu'] },
    { id: 'deaf', label: 'Người điếc', icon: Volume2, keywords: ['điếc', 'không nghe được', 'khiếm thính'] },
    { id: 'mute-deaf', label: 'Người câm và điếc', icon: Hand, keywords: ['câm và điếc', 'câm điếc'] }
  ];

  const communicationMatrix = {
    'normal-blind': ['text-audio', 'audio-audio'],
    'normal-mute': ['audio-text', 'audio-sign'],
    'normal-deaf': ['audio-text', 'audio-sign'],
    'blind-blind': ['audio-audio'],
    'mute-mute': ['text-text', 'sign-sign', 'audio-audio'],
    'mute-deaf': ['text-text', 'text-sign', 'sign-sign'],
    'deaf-deaf': ['text-text', 'text-sign', 'sign-text', 'sign-sign'],
    'deaf-blind': ['text-audio', 'sign-audio'],
    'mute-deaf-mute-deaf': ['text-text', 'text-sign', 'sign-text', 'sign-sign']
  };

  const getModeLabel = (mode) => {
    const labels = {
      'text-audio': 'Văn bản → Âm thanh',
      'audio-text': 'Âm thanh → Văn bản',
      'text-text': 'Văn bản → Văn bản',
      'audio-audio': 'Âm thanh → Âm thanh',
      'sign-audio': 'Ngôn ngữ ký hiệu → Âm thanh',
      'audio-sign': 'Âm thanh → Ngôn ngữ ký hiệu',
      'text-sign': 'Văn bản → Ngôn ngữ ký hiệu',
      'sign-text': 'Ngôn ngữ ký hiệu → Văn bản',
      'sign-sign': 'Ngôn ngữ ký hiệu → Ngôn ngữ ký hiệu'
    };
    return labels[mode] || mode;
  };

  const determineConversionModes = () => {
    if (!person1Type || !person2Type) return [];
    const key1 = `${person1Type}-${person2Type}`;
    const key2 = `${person2Type}-${person1Type}`;
    return communicationMatrix[key1] || communicationMatrix[key2] || [];
  };

  const speakText = useCallback((text) => {
    if (!text) return;
    
    // Kiểm tra xem SpeechSynthesis có sẵn không
    if (!('speechSynthesis' in window)) {
      console.warn('SpeechSynthesis không được hỗ trợ');
      return;
    }
    
    try {
      // Dừng tất cả giọng nói đang phát trước đó
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      
      setAiSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'vi-VN';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      utterance.onend = () => {
        setAiSpeaking(false);
      };
      
      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        setAiSpeaking(false);
      };
      
      // Đợi một chút để đảm bảo cancel đã hoàn tất (nếu có)
      if (window.speechSynthesis.speaking) {
        setTimeout(() => {
          window.speechSynthesis.speak(utterance);
        }, 100);
      } else {
        window.speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error('Lỗi khi phát giọng nói:', error);
      setAiSpeaking(false);
    }
  }, []);

  const detectDisabilityFromVoice = (text) => {
    const lowerText = text.toLowerCase();
    for (const type of disabilityTypes) {
      for (const keyword of type.keywords) {
        if (lowerText.includes(keyword)) {
          return type.id;
        }
      }
    }
    return null;
  };

  const startVoiceDetection = useCallback(() => {
    // Kiểm tra nếu đã có recognition đang chạy thì dừng lại
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore error
      }
      recognitionRef.current = null;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Trình duyệt không hỗ trợ nhận diện giọng nói. Vui lòng sử dụng Chrome hoặc Edge.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = 'vi-VN';
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.maxAlternatives = 1;

    recognitionRef.current.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      // Hiển thị text ngay lập tức (cả interim và final)
      setVoiceInput(finalTranscript || interimTranscript);
      
      if (finalTranscript) {
        if (step === 'voice-detect' && !person1Type) {
          const detected = detectDisabilityFromVoice(finalTranscript);
          if (detected) {
            setPerson1Type(detected);
            try {
              recognitionRef.current.stop();
            } catch (e) {
              // Ignore error
            }
            setIsListening(false);
            speakText(`Đã nhận diện: ${disabilityTypes.find(t => t.id === detected)?.label}. Bây giờ, người thứ hai vui lòng nói về tình trạng của mình.`);
            setTimeout(() => {
              setVoiceInput('');
              // Chờ AI nói xong (8 giây) mới bắt đầu ghi âm lại
              setTimeout(() => {
                startVoiceDetection();
              }, 8000);
            }, 1000);
          }
        } else if (step === 'voice-detect' && person1Type && !person2Type) {
          const detected = detectDisabilityFromVoice(finalTranscript);
          if (detected) {
            setPerson2Type(detected);
            try {
              recognitionRef.current.stop();
            } catch (e) {
              // Ignore error
            }
            setIsListening(false);
            speakText(`Đã nhận diện: ${disabilityTypes.find(t => t.id === detected)?.label}. Hệ thống đang tự động kết nối cho hai bạn.`);
            // Tự động chuyển sang bước communicate ngay lập tức, không cần chờ
            setTimeout(() => {
              const modes = determineConversionModes();
              if (modes.length > 0) {
                setConversionMode(modes[0]);
                setStep('communicate');
                // useEffect sẽ tự động bắt đầu mic/camera nếu cần
                speakText(`Đã sẵn sàng. Chế độ: ${getModeLabel(modes[0])}. Hệ thống sẽ tự động bắt đầu các tính năng cần thiết.`);
              } else {
                speakText('Xin lỗi, không tìm thấy phương thức giao tiếp phù hợp. Vui lòng thử lại.');
              }
            }, 2000);
          }
        }
      }
    };

    recognitionRef.current.onstart = () => {
      setIsListening(true);
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        alert('Vui lòng cho phép truy cập micro để sử dụng tính năng này.');
      }
      setIsListening(false);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
      // Không tự động khởi động lại nữa
    };

    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error('Failed to start recognition:', e);
      setIsListening(false);
    }
  }, [step, person1Type, person2Type, speakText]);

  useEffect(() => {
    if (step === 'voice-detect') {
      // Dừng tất cả speech recognition đang chạy
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore error
        }
        recognitionRef.current = null;
      }
      
      let startRecognitionTimeout;
      
      // Chỉ phát lời chào lần đầu tiên khi vào trang (chưa có person1Type)
      if (!hasWelcomedRef.current && !person1Type) {
        hasWelcomedRef.current = true;
        
        // Chờ 1s rồi mới nói
        const welcomeTimeout = setTimeout(() => {
          speakText('Xin chào! Chào mừng bạn đến với ứng dụng Cầu Nối Giao Tiếp. Bạn có vấn đề gì về giao tiếp? Vui lòng nói rõ tình trạng của bạn.');
          
          // Chờ AI nói xong (khoảng 10 giây) rồi mới bắt đầu ghi âm
          startRecognitionTimeout = setTimeout(() => {
            if (step === 'voice-detect') {
              startVoiceDetection();
            }
          }, 12000);
        }, 1000);
        
        return () => {
          clearTimeout(welcomeTimeout);
          if (startRecognitionTimeout) {
            clearTimeout(startRecognitionTimeout);
          }
          if (recognitionRef.current) {
            try {
              recognitionRef.current.stop();
            } catch (e) {
              // Ignore error
            }
          }
          window.speechSynthesis.cancel();
        };
      } else {
        // Các trường hợp khác: đã có person1Type hoặc đã welcome rồi
        // Nếu chưa có person2Type thì bắt đầu ghi âm ngay
        if (!person2Type) {
          startVoiceDetection();
        }
      }
    }
    
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore error
        }
      }
      // Chỉ cancel speech synthesis khi component unmount, không cancel khi dependencies thay đổi
      // window.speechSynthesis.cancel();
    };
  }, [step, person1Type, person2Type, speakText, startVoiceDetection]);

  // Tự động bắt đầu mic/camera khi chuyển sang bước communicate
  useEffect(() => {
    if (step === 'communicate' && conversionMode) {
      const needsMic = conversionMode.startsWith('audio') || conversionMode === 'sign-audio';
      const needsCamera = conversionMode.startsWith('sign');
      
      // Tự động bắt đầu các tính năng cần thiết sau 1 giây
      const autoStartTimeout = setTimeout(() => {
        if (needsMic && !isListening) {
          // Gọi startListening trực tiếp
          if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Trình duyệt không hỗ trợ nhận diện giọng nói');
            return;
          }

          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          if (recognitionRef.current) {
            try {
              recognitionRef.current.stop();
            } catch (e) {
              // Ignore
            }
          }
          
          recognitionRef.current = new SpeechRecognition();
          recognitionRef.current.lang = 'vi-VN';
          recognitionRef.current.continuous = true;
          recognitionRef.current.interimResults = true;
          recognitionRef.current.maxAlternatives = 1;

          recognitionRef.current.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const transcript = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                finalTranscript += transcript;
              } else {
                interimTranscript += transcript;
              }
            }
            
            setInputText(finalTranscript || interimTranscript);
          };

          recognitionRef.current.onstart = () => {
            setIsListening(true);
          };

          recognitionRef.current.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);
          };

          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error('Failed to start recognition:', e);
            setIsListening(false);
          }
        }
        
        if (needsCamera && !isCameraOn) {
          // Gọi startCamera trực tiếp
          navigator.mediaDevices.getUserMedia({ 
            video: { 
              width: 640, 
              height: 480,
              facingMode: 'user'
            } 
          }).then(stream => {
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              
              videoRef.current.onloadedmetadata = () => {
                if (canvasRef.current) {
                  canvasRef.current.width = videoRef.current.videoWidth;
                  canvasRef.current.height = videoRef.current.videoHeight;
                }
                
                // Khởi tạo MediaPipe Hands nếu chưa có
                if (!handsRef.current) {
                  const checkMediaPipe = setInterval(() => {
                    if (typeof window.Hands !== 'undefined' && typeof window.Camera !== 'undefined') {
                      clearInterval(checkMediaPipe);
                      
                      const hands = new window.Hands({
                        locateFile: (file) => {
                          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469404/${file}`;
                        }
                      });

                      hands.setOptions({
                        maxNumHands: 1,
                        modelComplexity: 1,
                        minDetectionConfidence: 0.5,
                        minTrackingConfidence: 0.5
                      });

                      hands.onResults((results) => {
                        if (canvasRef.current && videoRef.current && results.image) {
                          const canvasCtx = canvasRef.current.getContext('2d');
                          canvasCtx.save();
                          canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                          canvasCtx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

                          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                            if (window.drawConnectors && window.drawLandmarks && window.HAND_CONNECTIONS) {
                              for (const landmarks of results.multiHandLandmarks) {
                                window.drawConnectors(canvasCtx, landmarks, window.HAND_CONNECTIONS,
                                                     {color: '#00FF00', lineWidth: 2});
                                window.drawLandmarks(canvasCtx, landmarks, {color: '#FF0000', lineWidth: 1, radius: 3});
                              }
                            }

                            // Nhận diện cử chỉ
                            const landmarks = results.multiHandLandmarks[0];
                            // Sử dụng gestureDictionary trực tiếp
                            let detectedGesture = null;
                            for (const [gesture, checkFunction] of Object.entries(gestureDictionary)) {
                              if (checkFunction(landmarks)) {
                                detectedGesture = gesture;
                                break;
                              }
                            }
                            
                            if (detectedGesture) {
                              setDetectedText(prev => {
                                if (prev.slice(-1) !== detectedGesture) {
                                  const newText = prev + detectedGesture;
                                  setInputText(newText);
                                  return newText;
                                }
                                return prev;
                              });
                            }
                          }
                          canvasCtx.restore();
                        }
                      });

                      handsRef.current = hands;
                      
                      // Bắt đầu nhận diện
                      setIsDetecting(true);
                      let isProcessing = true;
                      const processFrame = async () => {
                        if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && handsRef.current && isProcessing) {
                          try {
                            await handsRef.current.send({ image: videoRef.current });
                          } catch (error) {
                            console.error('Error processing frame:', error);
                          }
                        }
                        if (isProcessing && videoRef.current && videoRef.current.srcObject) {
                          requestAnimationFrame(processFrame);
                        }
                      };
                      processFrame();
                      
                      videoRef.current._stopProcessing = () => {
                        isProcessing = false;
                      };
                    }
                  }, 100);

                  setTimeout(() => {
                    clearInterval(checkMediaPipe);
                  }, 10000);
                } else {
                  // Nếu đã có hands, bắt đầu nhận diện ngay
                  setIsDetecting(true);
                  let isProcessing = true;
                  const processFrame = async () => {
                    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && handsRef.current && isProcessing) {
                      try {
                        await handsRef.current.send({ image: videoRef.current });
                      } catch (error) {
                        console.error('Error processing frame:', error);
                      }
                    }
                    if (isProcessing && videoRef.current && videoRef.current.srcObject) {
                      requestAnimationFrame(processFrame);
                    }
                  };
                  processFrame();
                  
                  videoRef.current._stopProcessing = () => {
                    isProcessing = false;
                  };
                }
              };
            }
            setIsCameraOn(true);
          }).catch(err => {
            console.error('Không thể truy cập camera:', err);
          });
        }
      }, 1000);

      return () => clearTimeout(autoStartTimeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, conversionMode, isListening, isCameraOn]);

  // Từ điển cử chỉ tay cơ bản (có thể mở rộng)
  const gestureDictionary = {
    // Chữ cái cơ bản
    'A': (landmarks) => {
      // Ngón tay cái và 4 ngón khác nắm lại
      const thumbUp = landmarks[4].y < landmarks[3].y;
      const fingersDown = [landmarks[8].y > landmarks[6].y, landmarks[12].y > landmarks[10].y, 
                          landmarks[16].y > landmarks[14].y, landmarks[20].y > landmarks[18].y];
      return thumbUp && fingersDown.every(down => down);
    },
    'B': (landmarks) => {
      // Tất cả ngón tay duỗi thẳng
      const fingersUp = [landmarks[4].y < landmarks[3].y, landmarks[8].y < landmarks[6].y,
                        landmarks[12].y < landmarks[10].y, landmarks[16].y < landmarks[14].y,
                        landmarks[20].y < landmarks[18].y];
      return fingersUp.every(up => up);
    },
    'C': (landmarks) => {
      // Ngón tay cong như chữ C
      const thumbIn = landmarks[4].x > landmarks[3].x;
      const indexCurved = landmarks[8].y > landmarks[6].y && landmarks[8].x < landmarks[5].x;
      return thumbIn && indexCurved;
    },
    // Số đếm
    '1': (landmarks) => {
      // Chỉ ngón trỏ duỗi
      return landmarks[8].y < landmarks[6].y && 
             landmarks[12].y > landmarks[10].y && 
             landmarks[16].y > landmarks[14].y && 
             landmarks[20].y > landmarks[18].y;
    },
    '2': (landmarks) => {
      // Ngón trỏ và ngón giữa duỗi
      return landmarks[8].y < landmarks[6].y && 
             landmarks[12].y < landmarks[10].y && 
             landmarks[16].y > landmarks[14].y && 
             landmarks[20].y > landmarks[18].y;
    },
    '3': (landmarks) => {
      // Ba ngón đầu duỗi
      return landmarks[8].y < landmarks[6].y && 
             landmarks[12].y < landmarks[10].y && 
             landmarks[16].y < landmarks[14].y && 
             landmarks[20].y > landmarks[18].y;
    },
    '4': (landmarks) => {
      // Bốn ngón duỗi (trừ ngón cái)
      return landmarks[8].y < landmarks[6].y && 
             landmarks[12].y < landmarks[10].y && 
             landmarks[16].y < landmarks[14].y && 
             landmarks[20].y < landmarks[18].y;
    },
    '5': (landmarks) => {
      // Tất cả ngón tay duỗi
      return landmarks[4].y < landmarks[3].y && 
             landmarks[8].y < landmarks[6].y && 
             landmarks[12].y < landmarks[10].y && 
             landmarks[16].y < landmarks[14].y && 
             landmarks[20].y < landmarks[18].y;
    },
    // Cử chỉ đơn giản
    'OK': (landmarks) => {
      // Ngón cái và ngón trỏ tạo vòng tròn
      const thumbIndexDistance = Math.sqrt(
        Math.pow(landmarks[4].x - landmarks[8].x, 2) + 
        Math.pow(landmarks[4].y - landmarks[8].y, 2)
      );
      return thumbIndexDistance < 0.05;
    },
    'THUMBS_UP': (landmarks) => {
      // Ngón cái giơ lên
      return landmarks[4].y < landmarks[3].y && 
             landmarks[8].y > landmarks[6].y && 
             landmarks[12].y > landmarks[10].y && 
             landmarks[16].y > landmarks[14].y && 
             landmarks[20].y > landmarks[18].y;
    }
  };

  // Nhận diện cử chỉ từ landmarks
  const detectGesture = (landmarks) => {
    for (const [gesture, checkFunction] of Object.entries(gestureDictionary)) {
      if (checkFunction(landmarks)) {
        return gesture;
      }
    }
    return null;
  };

  // Khởi tạo MediaPipe Hands
  const initializeHands = useCallback(() => {
    // Đợi MediaPipe load
    const checkMediaPipe = setInterval(() => {
      if (typeof window.Hands !== 'undefined' && typeof window.Camera !== 'undefined') {
        clearInterval(checkMediaPipe);
        
        const hands = new window.Hands({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469404/${file}`;
          }
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        hands.onResults((results) => {
          if (canvasRef.current && videoRef.current && results.image) {
            const canvasCtx = canvasRef.current.getContext('2d');
            canvasCtx.save();
            canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            canvasCtx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
              // Vẽ landmarks nếu có drawing utils
              if (window.drawConnectors && window.drawLandmarks && window.HAND_CONNECTIONS) {
                for (const landmarks of results.multiHandLandmarks) {
                  window.drawConnectors(canvasCtx, landmarks, window.HAND_CONNECTIONS,
                                       {color: '#00FF00', lineWidth: 2});
                  window.drawLandmarks(canvasCtx, landmarks, {color: '#FF0000', lineWidth: 1, radius: 3});
                }
              }

              // Nhận diện cử chỉ từ bàn tay đầu tiên
              const landmarks = results.multiHandLandmarks[0];
              const gesture = detectGesture(landmarks);
              
              if (gesture) {
                setDetectedText(prev => {
                  // Thêm ký tự mới nếu khác với ký tự cuối (tránh lặp lại)
                  if (prev.slice(-1) !== gesture) {
                    const newText = prev + gesture;
                    // Tự động cập nhật inputText
                    setInputText(newText);
                    return newText;
                  }
                  return prev;
                });
              }
            }
            canvasCtx.restore();
          }
        });

        handsRef.current = hands;
      }
    }, 100);

    // Timeout sau 10 giây
    setTimeout(() => {
      clearInterval(checkMediaPipe);
      if (!handsRef.current) {
        console.error('MediaPipe Hands không thể tải');
        alert('Không thể tải MediaPipe Hands. Vui lòng kiểm tra kết nối internet.');
      }
    }, 10000);
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user'
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Đợi video sẵn sàng
        videoRef.current.onloadedmetadata = () => {
          if (canvasRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
          }
          
          // Khởi tạo MediaPipe Hands
          if (!handsRef.current) {
            initializeHands();
          }
          
          // Bắt đầu nhận diện sau khi MediaPipe đã sẵn sàng
          const startDetection = () => {
            if (handsRef.current) {
              setIsDetecting(true);
              // Sử dụng requestAnimationFrame để xử lý video
              let isProcessing = true;
              const processFrame = async () => {
                if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && handsRef.current && isProcessing) {
                  try {
                    await handsRef.current.send({ image: videoRef.current });
                  } catch (error) {
                    console.error('Error processing frame:', error);
                  }
                }
                if (isProcessing && videoRef.current && videoRef.current.srcObject) {
                  requestAnimationFrame(processFrame);
                }
              };
              processFrame();
              
              // Lưu hàm dừng
              videoRef.current._stopProcessing = () => {
                isProcessing = false;
              };
            } else {
              // Đợi MediaPipe sẵn sàng
              setTimeout(startDetection, 100);
            }
          };
          startDetection();
        };
      }
      setIsCameraOn(true);
    } catch (err) {
      alert('Không thể truy cập camera. Vui lòng cho phép quyền truy cập.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current) {
      if (videoRef.current._stopProcessing) {
        videoRef.current._stopProcessing();
      }
      if (videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    }
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
    setIsCameraOn(false);
    setIsDetecting(false);
    setDetectedText('');
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Trình duyệt không hỗ trợ nhận diện giọng nói');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = 'vi-VN';
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.maxAlternatives = 1;

    recognitionRef.current.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      // Hiển thị ngay lập tức
      setInputText(finalTranscript || interimTranscript);
    };

    recognitionRef.current.onstart = () => {
      setIsListening(true);
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognitionRef.current.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const processConversion = async () => {
    if (!inputText.trim() && !isCameraOn) {
      alert('Vui lòng nhập nội dung hoặc bật camera');
      return;
    }

    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    let result = '';
    if (conversionMode.includes('audio')) {
      if (conversionMode.startsWith('text') || conversionMode.startsWith('sign')) {
        speakText(inputText || 'Xin chào, tôi đang sử dụng ngôn ngữ ký hiệu');
        result = `🔊 Đang phát âm thanh: "${inputText || 'Từ ngôn ngữ ký hiệu'}"`;
      } else {
        result = inputText;
      }
    } else if (conversionMode.includes('sign')) {
      result = `👋 Chuyển đổi sang ngôn ngữ ký hiệu: ${inputText}`;
    } else {
      result = inputText;
    }

    setOutputText(result);
    setIsProcessing(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  if (step === 'voice-detect') {
    return (
      <div className="min-h-screen p-8 bg-cover bg-center bg-no-repeat" style={{backgroundImage: 'url(https://img.freepik.com/vector-mien-phi/hinh-anh-minh-hoa-nhung-nguoi-khuyet-tat-ve-tay_23-2149651422.jpg?t=st=1768818612~exp=1768822212~hmac=97295c8c881599bf14063081a9aecd4c14612a3d4dbd24df6349a828735c2f36&w=1060)'}}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-600 rounded-full mb-4 animate-pulse">
              <Mic className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Cầu Nối Giao Tiếp</h1>
            <p className="text-xl text-gray-600">Đang lắng nghe...</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <div className="flex items-center justify-center mb-6">
              <div className={`w-16 h-16 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-300'} flex items-center justify-center`}>
                <Mic className="w-8 h-8 text-white" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">
                  {aiSpeaking ? '🔊 AI đang nói...' : isListening ? '👂 Đang nghe, vui lòng chờ...' : '⏸️ Đã dừng'}
                </p>
                <p className="font-semibold text-blue-900">
                  {person1Type ? 'Người thứ hai, vui lòng nói về tình trạng của bạn' : 'Bạn có vấn đề gì về giao tiếp?'}
                </p>
              </div>

              {isListening && !voiceInput && !aiSpeaking && (
                <div className="bg-yellow-50 p-4 rounded-lg border-2 border-yellow-200 animate-pulse">
                  <p className="text-yellow-800 font-medium text-center">
                    🎤 Đang lắng nghe... Hãy nói rõ ràng
                  </p>
                </div>
              )}

              {voiceInput && (
                <div className="bg-gray-50 p-4 rounded-lg border-2 border-blue-300">
                  <p className="text-sm text-gray-600 mb-1">
                    {isListening ? '🔴 Đang ghi âm:' : '✓ Bạn vừa nói:'}
                  </p>
                  <p className="text-gray-900 font-medium">{voiceInput}</p>
                </div>
              )}

              {person1Type && (
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">✓ Người thứ nhất:</p>
                  <p className="font-semibold text-green-900">
                    {disabilityTypes.find(t => t.id === person1Type)?.label}
                  </p>
                </div>
              )}

              {person2Type && (
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">✓ Người thứ hai:</p>
                  <p className="font-semibold text-green-900">
                    {disabilityTypes.find(t => t.id === person2Type)?.label}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-800">
                💡 Hướng dẫn: Hãy nói rõ về tình trạng của bạn, ví dụ: "Tôi bị mù", "Tôi là người câm", "Tôi bị điếc"...
              </p>
            </div>

            <button
              onClick={() => {
                if (recognitionRef.current) {
                  recognitionRef.current.stop();
                }
                window.speechSynthesis.cancel();
                setStep('manual-select');
              }}
              className="w-full mt-6 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-xl transition duration-200"
            >
              Hoặc chọn thủ công
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'manual-select') {
    return (
      <div className="min-h-screen p-8 bg-cover bg-center bg-no-repeat" style={{backgroundImage: 'url(https://images.unsplash.com/photo-1557683316-973673baf926?w=1920&q=80)'}}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Chọn loại giao tiếp</h1>
            <p className="text-gray-600">Vui lòng chọn đặc điểm của hai người giao tiếp</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-semibold mb-4 text-indigo-600">Người thứ nhất</h2>
              <div className="grid grid-cols-1 gap-3">
                {disabilityTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setPerson1Type(type.id)}
                      className={`p-4 rounded-lg border-2 transition duration-200 flex items-center gap-3 ${
                        person1Type === type.id
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      <Icon className={`w-6 h-6 ${person1Type === type.id ? 'text-indigo-600' : 'text-gray-400'}`} />
                      <span className={`font-medium ${person1Type === type.id ? 'text-indigo-900' : 'text-gray-700'}`}>
                        {type.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-semibold mb-4 text-green-600">Người thứ hai</h2>
              <div className="grid grid-cols-1 gap-3">
                {disabilityTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setPerson2Type(type.id)}
                      className={`p-4 rounded-lg border-2 transition duration-200 flex items-center gap-3 ${
                        person2Type === type.id
                          ? 'border-green-600 bg-green-50'
                          : 'border-gray-200 hover:border-green-300'
                      }`}
                    >
                      <Icon className={`w-6 h-6 ${person2Type === type.id ? 'text-green-600' : 'text-gray-400'}`} />
                      <span className={`font-medium ${person2Type === type.id ? 'text-green-900' : 'text-gray-700'}`}>
                        {type.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep('voice-detect')}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-4 px-6 rounded-xl transition duration-200"
            >
              Quay lại
            </button>
            <button
              onClick={() => {
                if (!person1Type || !person2Type) {
                  alert('Vui lòng chọn cả hai loại giao tiếp');
                  return;
                }
                const modes = determineConversionModes();
                if (modes.length > 0) {
                  setConversionMode(modes[0]);
                  setStep('communicate');
                } else {
                  alert('Không tìm thấy phương thức giao tiếp phù hợp');
                }
              }}
              disabled={!person1Type || !person2Type}
              className={`flex-1 font-semibold py-4 px-6 rounded-xl transition duration-200 ${
                person1Type && person2Type
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Tiếp tục
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'communicate') {
    const modes = determineConversionModes();
    const needsMic = conversionMode.startsWith('audio') || conversionMode === 'sign-audio';
    const needsCamera = conversionMode.startsWith('sign');

    return (
      <div className="min-h-screen p-8 bg-cover bg-center bg-no-repeat" style={{backgroundImage: 'url(https://images.unsplash.com/photo-1557683316-973673baf926?w=1920&q=80)'}}>
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-gray-900">Giao tiếp</h1>
              <button
                onClick={() => {
                  stopCamera();
                  stopListening();
                  setStep('voice-detect');
                  setPerson1Type('');
                  setPerson2Type('');
                  hasWelcomedRef.current = false;
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition duration-200"
              >
                Bắt đầu lại
              </button>
            </div>
            
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 bg-indigo-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">Người 1</p>
                <p className="font-semibold text-indigo-900">
                  {disabilityTypes.find(t => t.id === person1Type)?.label}
                </p>
              </div>
              <ArrowRight className="w-6 h-6 text-gray-400" />
              <div className="flex-1 bg-green-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">Người 2</p>
                <p className="font-semibold text-green-900">
                  {disabilityTypes.find(t => t.id === person2Type)?.label}
                </p>
              </div>
            </div>

            {modes.length > 1 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chọn phương thức chuyển đổi:
                </label>
                <select
                  value={conversionMode}
                  onChange={(e) => setConversionMode(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {modes.map(mode => (
                    <option key={mode} value={mode}>{getModeLabel(mode)}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Chế độ hiện tại:</p>
              <p className="text-lg font-semibold text-blue-900">{getModeLabel(conversionMode)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">Đầu vào</h2>
              
              <div className="space-y-4 mb-4">
                {needsMic && (
                  <button
                    onClick={isListening ? stopListening : startListening}
                    className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold transition duration-200 ${
                      isListening
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-green-500 hover:bg-green-600 text-white'
                    }`}
                  >
                    <Mic className="w-5 h-5" />
                    {isListening ? 'Dừng ghi âm' : 'Bắt đầu ghi âm'}
                  </button>
                )}

                {needsCamera && (
                  <button
                    onClick={isCameraOn ? stopCamera : startCamera}
                    className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold transition duration-200 ${
                      isCameraOn
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                  >
                    <Camera className="w-5 h-5" />
                    {isCameraOn ? 'Tắt camera' : 'Bật camera'}
                  </button>
                )}
              </div>

              {needsCamera && isCameraOn && (
                <div className="mb-4">
                  <div className="relative">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full rounded-lg bg-black"
                      style={{ display: 'block' }}
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute top-0 left-0 w-full h-full rounded-lg"
                      style={{ pointerEvents: 'none' }}
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-2 text-center">
                    {isDetecting ? '🎥 Đang nhận diện cử chỉ tay...' : 'Camera đang hoạt động - Sử dụng ngôn ngữ ký hiệu'}
                  </p>
                  {detectedText && (
                    <div className="mt-3 p-3 bg-green-50 rounded-lg border-2 border-green-200">
                      <p className="text-sm text-gray-600 mb-1">📝 Văn bản đã nhận diện:</p>
                      <p className="text-lg font-semibold text-green-900">{detectedText}</p>
                      <button
                        onClick={() => {
                          setInputText(detectedText);
                          setDetectedText('');
                        }}
                        className="mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition duration-200"
                      >
                        Sử dụng văn bản này
                      </button>
                      <button
                        onClick={() => setDetectedText('')}
                        className="mt-2 ml-2 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg text-sm font-medium transition duration-200"
                      >
                        Xóa
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!needsCamera && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nhập văn bản:
                  </label>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg h-32 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Nhập nội dung cần chuyển đổi..."
                  />
                </div>
              )}

              <button
                onClick={processConversion}
                disabled={isProcessing}
                className={`w-full py-3 px-4 rounded-lg font-semibold transition duration-200 ${
                  isProcessing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                } text-white`}
              >
                {isProcessing ? 'Đang xử lý...' : 'Chuyển đổi'}
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">Đầu ra</h2>
              
              <div className="bg-gray-50 rounded-lg p-4 min-h-[300px]">
                {outputText ? (
                  <div className="space-y-2">
                    <p className="text-gray-800 whitespace-pre-wrap">{outputText}</p>
                  </div>
                ) : (
                  <p className="text-gray-400 text-center mt-12">
                    Kết quả chuyển đổi sẽ hiển thị ở đây
                  </p>
                )}
              </div>

              {outputText && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-800">✓ Chuyển đổi thành công!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default AccessibilityBridge;