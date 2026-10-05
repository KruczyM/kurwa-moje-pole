import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image
import trimesh
import hunyuan_batch as batch


class QueueTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def views(self, name):
        folder = self.root / name
        folder.mkdir()
        for i, view in enumerate(batch.VIEWS):
            Image.new('RGB', (128, 128), (i*50, 0, 0)).save(folder / (view+'.png'))
        return folder

    def test_missing_view_rejected(self):
        folder = self.views('test')
        (folder / 'back.png').unlink()
        jobs, errors = batch.discover(self.root, {'models': {}})
        self.assertFalse(jobs)
        self.assertIn('test', errors)

    def test_qa_and_kilt_mapping(self):
        self.views('pikachu_guy_ref_1789953988229')
        paths = {v: self.root / 'pikachu_guy_ref_1789953988229' / f'{v}.png' for v in batch.VIEWS}
        pika_hash = batch.compute_model_hash(paths)
        self.views('kilt_punk_ref_1789954056754')
        manifest = {'models': {'pikachu_guy_ref_1789953988229': {'status': 'rejected', 'hash': pika_hash}}}
        jobs, errors = batch.discover(self.root, manifest)
        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0][1]['left'].name, 'right.png')
        self.assertEqual(len(errors), 1)

    def test_resume_checks_inputs_settings_and_output_hash(self):
        folder = self.views('test')
        paths = {v: folder/(v+'.png') for v in batch.VIEWS}
        signature = batch.fingerprint(paths, {'steps': 5})
        meshpath = folder / 'shape.glb'
        trimesh.creation.box().export(meshpath)
        batch.validate_mesh(meshpath)
        with self.assertRaisesRegex(ValueError, 'no embedded texture'):
            batch.validate_mesh(meshpath, require_texture=True)
        batch.write_json(folder/'result.json', {
            'signature': signature,
            'sha256': {'shape.glb': batch.hashlib.sha256(meshpath.read_bytes()).hexdigest()}})
        self.assertTrue(batch.completed(folder, signature, False))
        self.assertFalse(batch.completed(folder, batch.fingerprint(paths, {'steps': 6}), False))
        Image.new('RGB', (128, 128), 'white').save(paths['front'])
        self.assertNotEqual(signature, batch.fingerprint(paths, {'steps': 5}))
        meshpath.write_bytes(b'broken')
        self.assertFalse(batch.completed(folder, signature, False))

    def test_exact_four_view_api_order_and_commit(self):
        from types import SimpleNamespace
        from unittest.mock import Mock
        folder = self.views('test')
        paths = {v: folder/(v+'.png') for v in batch.VIEWS}
        output = self.root / 'output'
        output.mkdir()
        mesh = self.root/'mesh.glb'
        trimesh.creation.box().export(mesh)
        job = Mock()
        job.done.return_value = True
        job.result.return_value = (str(mesh), '<html>', {'ok': True}, 1234)
        client = Mock()
        client.submit.return_value = job
        args = SimpleNamespace(shape_only=True, steps=5, guidance=5.0, seed=1234,
                               resolution=256, chunks=8000, job_timeout=60)
        with patch('gradio_client.handle_file', side_effect=lambda p: p):
            batch.run_job(client, args, output, 'test', paths, {'remove_background': True})
        self.assertEqual(client.submit.call_args.args[2:6], tuple(str(paths[v]) for v in batch.VIEWS))
        self.assertEqual(client.submit.call_args.kwargs['api_name'], '/shape_generation')
        fingerprint = batch.fingerprint(paths, {'remove_background': True})
        self.assertTrue(batch.completed(output/'test'/f"variant_{fingerprint}", fingerprint, False))
        
        # Test second variant with different parameters
        args2 = SimpleNamespace(shape_only=True, steps=10, guidance=5.0, seed=1234,
                               resolution=256, chunks=8000, job_timeout=60)
        with patch('gradio_client.handle_file', side_effect=lambda p: p):
            batch.run_job(client, args2, output, 'test', paths, {'remove_background': True, 'steps': 10})
        fingerprint2 = batch.fingerprint(paths, {'remove_background': True, 'steps': 10})
        self.assertTrue(batch.completed(output/'test'/f"variant_{fingerprint2}", fingerprint2, False))
        self.assertNotEqual(fingerprint, fingerprint2)
        
        # Ensure both variants exist
        self.assertTrue((output/'test'/f"variant_{fingerprint}").is_dir())
        self.assertTrue((output/'test'/f"variant_{fingerprint2}").is_dir())

    def test_sequential_batch_and_failure_stops_next_model(self):
        from unittest.mock import Mock
        self.views('a')
        self.views('b')
        output = self.root/'output'
        # Output outside the input tree avoids treating it as an input model.
        inputs = self.root/'inputs'
        inputs.mkdir()
        for name in ('a', 'b'):
            (self.root/name).rename(inputs/name)
        proc = Mock()
        proc.poll.return_value = 0
        calls = []
        def process(client, args, out, name, paths, settings):
            if name == 'b':
                self.assertTrue((out/'a_saved').exists())
            (out/(name+'_saved')).touch()
            calls.append(name)
        argv = ['--input', str(inputs), '--output', str(output), '--shape-only']
        with patch.object(batch, 'start_server', return_value=proc), \
             patch.object(batch, 'connect', return_value=Mock()), \
             patch.object(batch, 'run_job', side_effect=process):
            self.assertEqual(batch.main(argv), 0)
        self.assertEqual(calls, ['a', 'b'])
        self.assertFalse((output/'queue.lock').exists())
        with patch.object(batch, 'start_server', return_value=proc), \
             patch.object(batch, 'connect', return_value=Mock()), \
             patch.object(batch, 'run_job', side_effect=RuntimeError('GPU failure')) as run:
            with self.assertRaisesRegex(RuntimeError, 'GPU failure'):
                batch.main(argv)
            self.assertEqual(run.call_count, 1)
        self.assertFalse((output/'queue.lock').exists())
        self.assertEqual(json.loads((output/'status.json').read_text())['event'], 'failed')


if __name__ == '__main__':
    unittest.main()
