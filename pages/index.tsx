import React from 'react';
import Head from 'next/head';
import PathfindingSimulator from '../components/PathfindingSimulator';

const Home: React.FC = () => {
  return (
    <div>
      <Head>
        <title>Pathfinding Simulator</title>
        <meta name="description" content="A pathfinding simulator with monsters and base defense" />
      </Head>

      <main>
        <PathfindingSimulator />
      </main>
    </div>
  );
};

export default Home;