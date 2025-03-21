import React, { useState, useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

// Skybox component for displaying 6 textures
function Skybox({ textures }) {
  const { scene } = useThree();

  useEffect(() => {
    if (Object.values(textures).every((t) => t)) {
      const materials = [
        new THREE.MeshBasicMaterial({ map: textures.right, side: THREE.BackSide }),
        new THREE.MeshBasicMaterial({ map: textures.left, side: THREE.BackSide }),
        new THREE.MeshBasicMaterial({ map: textures.top, side: THREE.BackSide }),
        new THREE.MeshBasicMaterial({ map: textures.bottom, side: THREE.BackSide }),
        new THREE.MeshBasicMaterial({ map: textures.front, side: THREE.BackSide }),
        new THREE.MeshBasicMaterial({ map: textures.back, side: THREE.BackSide }),
      ];

      const skybox = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), materials);
      scene.add(skybox);

      return () => {
        scene.remove(skybox);
      };
    }
  }, [textures]);

  return null;
}

function BloodMarker({ positions = [], roomSize = 10 }) {
  const { scene } = useThree();
  const arrowRefs = useRef([]);
  
  useEffect(() => {
    arrowRefs.current.forEach((arrow) => scene.remove(arrow));
    arrowRefs.current = [];

    if (positions.length > 0) {
      positions.forEach((pos) => {
        const imageWidth = 1024;
        const imageHeight = 768;

        const mappedX = (pos.x / imageWidth) * roomSize - roomSize / 2;
        const mappedZ = -(pos.y / imageHeight) * roomSize + roomSize / 2;
        const mappedY = pos.z || 1.5;

        const boxGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const boxMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        box.position.set(mappedX, mappedY, mappedZ);
        scene.add(box);
      });

      scene.needsUpdate = true;
    }

    return () => {
      arrowRefs.current.forEach((arrow) => scene.remove(arrow));
    };
  }, [positions, scene]);

  return null;
}

// Main app component
function App() {
  const [textures, setTextures] = useState({
    right: null,
    left: null,
    top: null,
    bottom: null,
    front: null,
    back: null,
  });

  const [allUploaded, setAllUploaded] = useState(false);
  const [bloodMarkerPosition, setBloodMarkerPosition] = useState(null);

  useEffect(() => {
    if (Object.values(textures).every((t) => t !== null)) {
      setAllUploaded(true);
    }
  }, [textures]);

  const handleImageUpload = async (event, side) => {
    const file = event.target.files[0];
    if (!file) return;
  
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        if (side !== "bottom") {
          const texture = new THREE.TextureLoader().load(e.target.result);
          setTextures((prev) => ({ ...prev, [side]: texture }));
          return;
        }
  
        const processedImageUrl = "http://127.0.0.1:8000/static/processed_image.jpg";
        const texture = new THREE.TextureLoader().load(processedImageUrl);
  
        setTextures((prev) => ({ ...prev, bottom: texture }));
        setBloodMarkerPosition(null);
      } catch (error) {
        console.error("Error processing image:", error);
      }
    };
  
    reader.readAsDataURL(file);
  };
  
  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          background: "rgba(255, 255, 255, 0.9)",
          padding: "15px",
          borderRadius: "8px",
          boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.1)",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          width: "220px",
          backdropFilter: "blur(5px)",
        }}
      >
        {["right", "left", "top", "bottom", "front", "back"].map((side) => (
          <div key={side} style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <label style={{ fontWeight: "bold", fontSize: "14px", color: "black" }}>
              {side.toUpperCase()}
            </label>
            <input
              type="file"
              onChange={(e) => handleImageUpload(e, side)}
              style={{
                padding: "5px",
                color: "black",
                backgroundColor: "white",
                border: "1px solid black",
                borderRadius: "4px",
              }}
            />
          </div>
        ))}
      </div>
  
      <Canvas camera={{ position: [0, 3, 5], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={1} />
        <OrbitControls enablePan={false} enableZoom={true} />
  
        {allUploaded && <Skybox textures={textures} />}
        {bloodMarkerPosition && <BloodMarker positions={bloodMarkerPosition} />}
      </Canvas>
    </div>
  );
}

export default App;
