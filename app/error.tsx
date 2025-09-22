"use client"

import * as React from 'react'
import Link from 'next/link'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	return (
		<html>
			<body style={{
				display: 'flex',
				minHeight: '100dvh',
				alignItems: 'center',
				justifyContent: 'center',
				padding: '2rem',
				textAlign: 'center',
			}}>
				<div>
					<h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Something went wrong</h1>
					{error?.digest ? (
						<p style={{ opacity: 0.8, marginTop: '0.5rem' }}>Error ID: {error.digest}</p>
					) : null}
					<div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
						<button
							onClick={() => reset()}
							style={{
								padding: '0.5rem 0.75rem',
								borderRadius: '9999px',
								border: '1px solid var(--border-color, #e5e7eb)'
							}}
						>
							Try again
						</button>
						<Link href="/" style={{
							display: 'inline-block',
							padding: '0.5rem 0.75rem',
							borderRadius: '9999px',
							border: '1px solid var(--border-color, #e5e7eb)'
						}}>
							Return home
						</Link>
					</div>
				</div>
			</body>
		</html>
	)
}
