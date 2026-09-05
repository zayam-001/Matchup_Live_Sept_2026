import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Environment, ContactShadows, PresentationControls } from '@react-three/drei';
import * as THREE from 'three';

const PadelRacket = ({ color = '#4F46E5', ...props }: any) => {
  return (
    <group {...props}>
      {/* Handle */}
      <mesh position={[0, -1.2, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 1.4, 16]} />
        <meshStandardMaterial color="#1E293B" roughness={0.8} />
      </mesh>
      
      {/* Handle Grip Tape (Stylized) */}
      <mesh position={[0, -1.2, 0]} scale={[1.05, 1, 1.05]}>
        <cylinderGeometry args={[0.12, 0.12, 1.3, 16]} />
        <meshStandardMaterial color="#0F172A" roughness={0.9} wireframe />
      </mesh>
      
      {/* Head Outer Rim */}
      <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.1, 1.1, 0.15, 32]} />
        <meshStandardMaterial color={color} roughness={0.2} metalness={0.3} />
      </mesh>
      
      {/* Inner Head / Face */}
      <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.9, 1.1, 0.9]}>
        <cylinderGeometry args={[1.1, 1.1, 0.16, 32]} />
        <meshStandardMaterial color="#020617" roughness={0.9} />
      </mesh>

      {/* Holes in the racket face */}
      {Array.from({ length: 7 }).map((_, i) => 
        Array.from({ length: 7 }).map((_, j) => {
          const x = (i - 3) * 0.25;
          const y = (j - 3) * 0.25;
          if (x*x + y*y < 0.7) {
            return (
              <mesh key={`${i}-${j}`} position={[x, y + 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.04, 0.04, 0.18, 8]} />
                <meshBasicMaterial color="#1E293B" />
              </mesh>
            )
          }
          return null;
        })
      )}
    </group>
  );
};

const PadelBall = (props: any) => {
  return (
    <group {...props}>
      <mesh>
        <sphereGeometry args={[0.25, 32, 32]} />
        <meshStandardMaterial color="#EAB308" roughness={0.4} metalness={0.1} />
      </mesh>
    </group>
  );
};

export const Hero3D = () => {
  return (
    <div className="absolute inset-0 w-full h-full z-0">
      <Canvas 
        camera={{ position: [0, 0, 10], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ 
          antialias: false, 
          powerPreference: 'high-performance',
          alpha: true
        }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} />
        <directionalLight position={[-10, -10, -5]} intensity={1} color="#4F46E5" />
        
        <PresentationControls 
          global 
          snap
          rotation={[0, 0, 0]} 
          polar={[-Math.PI / 3, Math.PI / 3]} 
          azimuth={[-Math.PI / 1.4, Math.PI / 2]}
        >
          <Float speed={2} rotationIntensity={1.5} floatIntensity={2}>
            <PadelRacket position={[-3, 1, 0]} rotation={[0.4, 0.6, -0.2]} color="#E11D48" />
          </Float>
          
          <Float speed={1.5} rotationIntensity={2} floatIntensity={1.5}>
            <PadelRacket position={[3, -1, -2]} rotation={[-0.2, -0.8, 0.2]} color="#4F46E5" />
          </Float>

          <Float speed={3} rotationIntensity={2} floatIntensity={3}>
            <PadelBall position={[0, 2, 1]} />
          </Float>

          <Float speed={2.5} rotationIntensity={2} floatIntensity={2}>
            <PadelBall position={[-2, -2, 2]} />
          </Float>
          
          <Float speed={2} rotationIntensity={3} floatIntensity={2.5}>
            <PadelBall position={[4, 2, -3]} />
          </Float>
        </PresentationControls>

        <Environment preset="city" />
      </Canvas>
    </div>
  );
};
