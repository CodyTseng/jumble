import React, { useEffect, useRef } from 'react'
import './CodepenLightning.css'

interface CodepenLightningProps {
  duration?: number // in milliseconds
  active?: boolean
}

export const CodepenLightning: React.FC<CodepenLightningProps> = ({
  duration = 1000,
  active = true
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Generate a lightning bolt based on the codepen example
  const generateLightning = () => {
    if (!svgRef.current || !containerRef.current) return

    const svg = svgRef.current
    const ancho = containerRef.current.clientWidth
    const altura = containerRef.current.clientHeight

    // Calculate a safe starting position that's not too close to the edges
    // Use the central 70% of the available width to keep main bolt path visible
    const safeWidthStart = ancho * 0.15 // 15% from left edge
    const safeWidthEnd = ancho * 0.85 // 15% from right edge
    const safeWidth = safeWidthEnd - safeWidthStart

    const xInicio = safeWidthStart + Math.random() * safeWidth
    let yActual = 0
    let zigzag = `M${xInicio},${yActual}`

    // Slightly thicker stroke for a single bolt
    const grosor = Math.random() * 3 + 2 // 2-5px instead of 1-4px

    // Only white or yellow colors - no black
    const color = Math.random() > 0.5 ? 'white' : 'yellow'

    // Create the zigzag pattern
    const segments = Math.floor(Math.random() * 3 + 5) // 5-7 segments

    for (let i = 0; i < segments; i++) {
      // Calculate offsets - allow more freedom but maintain main bolt visibility
      const maxOffset = Math.min(100, safeWidth * 0.25) // Increased from 80px/20% to 100px/25%
      const xOffset = (Math.random() - 0.5) * maxOffset

      // Calculate y position to ensure bolts extend across the whole screen
      // Last segment should always reach the bottom
      let yOffset
      if (i === segments - 1) {
        yOffset = altura - yActual // Ensure the last segment reaches the bottom
      } else {
        // Distribute remaining segments across the screen
        yOffset = (altura / segments) * (1 + Math.random() * 0.5)
      }

      yActual += yOffset

      // Ensure main bolt path stays within reasonable bounds but with more freedom
      // Only constrain if it's getting too close to the edge
      let newX = xInicio + xOffset
      const edgeBuffer = ancho * 0.08 // 8% buffer from edge
      if (newX < edgeBuffer) newX = edgeBuffer
      if (newX > ancho - edgeBuffer) newX = ancho - edgeBuffer

      zigzag += ` L${newX},${yActual}`

      // Add random branches with greater freedom to extend
      if (Math.random() > 0.7) {
        // Allow branches to extend further out
        const branchOffsetMax = maxOffset * 0.8 // Increased from 0.5 to 0.8 of main bolt offset
        const branchOffset = (Math.random() - 0.5) * branchOffsetMax
        let branchX = newX + branchOffset

        // Don't constrain branches as strictly, allow them to extend beyond safe zone
        // Just make sure they don't go completely off-screen
        const edgeBuffer = ancho * 0.05 // 5% buffer from edge
        if (branchX < edgeBuffer) branchX = edgeBuffer
        if (branchX > ancho - edgeBuffer) branchX = ancho - edgeBuffer

        const branchY = yActual + Math.random() * 30
        zigzag += ` M${newX},${yActual} L${branchX},${branchY} M${newX},${yActual}`
      }
    }

    // Create the SVG path element
    const linea = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    linea.setAttribute('d', zigzag)
    linea.setAttribute('class', 'rayo')
    linea.setAttribute('stroke', color)
    linea.setAttribute('stroke-width', grosor.toString())
    linea.setAttribute('fill', 'none') // Explicitly set no fill
    svg.appendChild(linea)

    // Add flash effect to the container
    if (containerRef.current) {
      containerRef.current.classList.add('flash')
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.classList.remove('flash')
        }
      }, 200)
    }

    // Clean up the lightning after animation
    setTimeout(() => {
      if (svg.contains(linea)) {
        svg.removeChild(linea)
      }
    }, 800) // Slightly longer to match the longer fade-out
  }

  useEffect(() => {
    if (!active) return

    // Generate a single lightning bolt
    const createLightnings = () => {
      // Just one bolt that appears immediately
      setTimeout(generateLightning, 0)
    }

    // Initial set of lightning
    createLightnings()

    // Cleanup
    timerRef.current = setTimeout(() => {
      // Cleanup will happen naturally as each bolt removes itself
    }, duration)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [active, duration])

  return (
    <div ref={containerRef} className="lightning-container">
      <svg ref={svgRef} className="lightning-svg"></svg>
    </div>
  )
}

export default CodepenLightning
