import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client/react';
import client from './apollo';
import Header from './components/Header';
import Presidents from './pages/Presidents';
import President from './pages/President';
import Home from './pages/Home';
import Detail from './pages/Detail';
import FullText from './pages/FullText';
import SupremeCourt from './pages/SupremeCourt';
import Timeline from './pages/Timeline';
import NaturalCourt from './pages/NaturalCourt';
import CaseDetail from './pages/CaseDetail';
import Congress from './pages/Congress';
import CongressSession from './pages/CongressSession';
import BillDetail from './pages/BillDetail';
import CorpusBrowser from './pages/CorpusBrowser';
import CaseGraph from './pages/CaseGraph';
import DataSources from './pages/DataSources';
import TagsIndex from './pages/TagsIndex';
import TagPage from './pages/TagPage';
import ExecutiveOrders from './pages/ExecutiveOrders';
import './index.css';

export default function App() {
  return (
    <ApolloProvider client={client}>
      <BrowserRouter>
        <Header />
        <Routes>
          <Route path="/" element={<Presidents />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/supreme-court" element={<SupremeCourt />} />
          <Route path="/supreme-court/:courtSlug" element={<NaturalCourt />} />
          <Route path="/supreme-court/:courtSlug/:caseId" element={<CaseDetail />} />
          <Route path="/congress" element={<Congress />} />
          <Route path="/congress/:number" element={<CongressSession />} />
          <Route path="/congress/:number/:billType/:billNumber" element={<BillDetail />} />
          <Route path="/corpus" element={<CorpusBrowser />} />
          <Route path="/case-graph" element={<CaseGraph />} />
          <Route path="/sources" element={<DataSources />} />
          <Route path="/tags" element={<TagsIndex />} />
          <Route path="/tags/:word" element={<TagPage />} />
          <Route path="/executive-orders" element={<ExecutiveOrders />} />
          <Route path="/:slug" element={<President />} />
          <Route path="/:slug/:docType" element={<Home />} />
          <Route path="/:slug/:docType/eo/:number" element={<Detail />} />
          <Route path="/:slug/:docType/eo/:number/text" element={<FullText />} />
        </Routes>
      </BrowserRouter>
    </ApolloProvider>
  );
}
